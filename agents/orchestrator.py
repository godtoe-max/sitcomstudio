import asyncio
import logging
import random
import json
from typing import Dict, Any, List, Callable, Awaitable
from .showrunner import ShowrunnerAgent
from .character import CharacterAgent
from .art_director import ArtDirectorAgent

logger = logging.getLogger("sitcom.orchestrator")

class EpisodeOrchestrator:
    def __init__(self, emit_callback: Callable[[Dict[str, Any]], Awaitable[None]]):
        self.emit = emit_callback
        self.showrunner = ShowrunnerAgent()
        self.art_director = ArtDirectorAgent()
        self.is_running = True

    async def run_episode(self, show_name: str, episode_prompt: str, lines_per_scene: int = 12, guest_name: str = ""):
        """
        Executes the full multi-agent episode lifecycle.
        Streams structured events over WebSocket.
        """
        # Step 1: The Showrunner drafts the Show Bible & Outline (Claude 3.5 Sonnet)
        await self.emit({
            "type": "status",
            "message": f"Showrunner is pitching '{show_name}' episode concepts..."
        })

        bible = await self.showrunner.develop_episode(show_name, episode_prompt, guest_name)
        
        await self.emit({
            "type": "show_bible_ready",
            "data": bible
        })

        # Step 2: Assemble the Cast Agents (GPT-4o)
        characters_data = bible.get("characters", [])
        cast_agents: Dict[str, CharacterAgent] = {}
        for cdata in characters_data:
            agent = CharacterAgent(cdata, show_title=bible.get("show_title", show_name))
            cast_agents[agent.id] = agent

        scenes = bible.get("scenes", [])
        artwork_tasks = []
        accepted_episode = []
        review_warning_sent = False
        
        # Step 3: Act out each Scene
        for s_idx, scene in enumerate(scenes):
            if not self.is_running:
                break

            scene_num = scene.get("scene_number", s_idx + 1)
            location = scene.get("location", "Main Set")
            title = scene.get("title", f"Scene {scene_num}")

            await self.emit({
                "type": "scene_start",
                "data": {
                    "scene_number": scene_num,
                    "title": title,
                    "location": location,
                    "director_notes": scene.get("director_notes", ""),
                    "participating_characters": scene.get("participating_characters", [])
                }
            })

            # Start storyboard generation in background
            visual_prompt = scene.get("storyboard_visual_prompt", f"{title} at {location}")
            visual_prompt += "\nCast continuity: " + json.dumps([
                {"name": c["name"], "role": c.get("cast_role"), "era": c.get("era", ""),
                 "personality": c.get("personality", ""), "color": c.get("avatar_color", "")}
                for c in characters_data])
            artwork_tasks.append(asyncio.create_task(self._generate_and_emit_storyboard(
                scene_num, title, location, visual_prompt, bible.get("show_title", show_name)
            )))

            # Determine participating actors
            participant_ids = scene.get("participating_characters", [])
            active_cast = [cast_agents[cid] for cid in participant_ids if cid in cast_agents]
            if len(active_cast) < 2:
                # Fallback to all cast if less than 2 listed
                active_cast = list(cast_agents.values())[:3]

            dialogue_history: List[Dict[str, str]] = []
            last_speaker_id = None

            speaking_counts = {a.id: 0 for a in active_cast}

            # Give every cast member a turn before repeating speakers.
            for turn in range(max(lines_per_scene, len(active_cast))):
                if not self.is_running:
                    break

                # Arbiter: pick next speaker
                candidates = [a for a in active_cast if a.id != last_speaker_id]
                if not candidates:
                    candidates = active_cast
                fewest = min(speaking_counts[a.id] for a in candidates)
                next_agent = random.choice([a for a in candidates if speaking_counts[a.id] == fewest])
                speaking_counts[next_agent.id] += 1

                # Emit agent thinking signal (Inspectable inner monologue in frontend!)
                await self.emit({
                    "type": "agent_thinking",
                    "data": {
                        "agent_id": next_agent.id,
                        "agent_name": next_agent.name,
                        "avatar_color": next_agent.avatar_color
                    }
                })

                # Agent generates line
                line_data = await next_agent.speak(
                    scene_info=scene,
                    dialogue_history=dialogue_history,
                    other_characters=[a.name for a in active_cast if a.id != next_agent.id]
                )

                rejected_takes = []
                approved = False
                for take in range(1, 4):
                    if not self.is_running:
                        return
                    review = await self.showrunner.review_line(
                        bible, scene, accepted_episode,
                        next(c for c in characters_data if c["id"] == next_agent.id), line_data)
                    if review.get("review_unavailable") and not review_warning_sent:
                        review_warning_sent = True
                        await self.emit({"type": "status", "message": "Showrunner review is unavailable; basic repetition checks are still active."})
                    if not review.get("redo"):
                        approved = True
                        break
                    await self.emit({"type": "showrunner_cut", "data": {
                        "speaker_name": next_agent.name, "scene_number": scene_num,
                        "take": take, "rejected_speech": line_data.get("speech", ""),
                        "reason": review.get("reason", "This beat needs another take."),
                        "direction": review.get("direction", "Try a fresh action tied to the scene."),
                        "final_attempt": take == 3}})
                    if take == 3:
                        break
                    rejected_takes.append(line_data.get("speech", ""))
                    line_data = await next_agent.speak(
                        scene_info=scene, dialogue_history=dialogue_history,
                        other_characters=[a.name for a in active_cast if a.id != next_agent.id],
                        director_feedback=review.get("direction", "Try a different beat."),
                        rejected_takes=rejected_takes)
                if not approved:
                    continue  # Never put a rejected take in the final screenplay or replay.
                accepted_episode.append({"speaker": next_agent.name, "speech": line_data.get("speech", "")})
                last_speaker_id = next_agent.id
                dialogue_history.append({
                    "speaker": line_data.get("speaker_name", next_agent.name),
                    "speech": line_data.get("speech", "")
                })

                # Stream dialogue line with stage directions, audience reaction & inner thought
                await self.emit({
                    "type": "dialogue_line",
                    "data": {
                        "turn": turn + 1,
                        "take": take,
                        "voice_id": next_agent.voice_id,
                        "scene_number": scene_num,
                        "speaker_id": next_agent.id,
                        "speaker_name": next_agent.name,
                        "avatar_color": next_agent.avatar_color,
                        "speech": line_data.get("speech", ""),
                        "stage_direction": line_data.get("stage_direction", ""),
                        "audience_reaction": line_data.get("audience_reaction", "[None]"),
                        "inner_thought": line_data.get("inner_thought", "")
                    }
                })

                # Comedic pacing pause
                await asyncio.sleep(2.5)

            await self.emit({
                "type": "scene_end",
                "data": {"scene_number": scene_num}
            })
            await asyncio.sleep(1.0)

        await self.emit({
            "type": "episode_complete",
            "data": {
                "episode_title": bible.get("episode_title", "Untitled Episode"),
                "logline": bible.get("logline", "")
            }
        })

        # The read is ready immediately; finish outstanding art before accepting another episode.
        if artwork_tasks:
            await asyncio.gather(*artwork_tasks, return_exceptions=True)
        await self.emit({"type": "artwork_complete"})

    async def _generate_and_emit_storyboard(
        self,
        scene_num: int,
        title: str,
        location: str,
        visual_prompt: str,
        show_title: str
    ):
        # 1. Immediately emit the stylized vector storyboard card so UI has artwork instantly!
        instant_panel = self.art_director._create_stylized_svg_fallback(
            scene_number=scene_num,
            scene_title=title,
            location=location,
            visual_prompt=visual_prompt,
            show_title=show_title
        )
        instant_panel["pending"] = True
        await self.emit({
            "type": "storyboard_ready",
            "data": instant_panel
        })

        # 2. Concurrently render Claude illustrated storyboards and upgrade seamlessly
        try:
            full_panel = await self.art_director.generate_storyboard_panel(
                scene_number=scene_num,
                scene_title=title,
                location=location,
                visual_prompt=visual_prompt,
                show_title=show_title
            )
            full_panel["pending"] = False
            await self.emit({"type": "storyboard_updated", "data": full_panel})
        except Exception as e:
            logger.warning(f"Error in background image generation: {e}")
            instant_panel.update(pending=False, error="Artwork generation failed. Check the server log.")
            await self.emit({"type": "storyboard_updated", "data": instant_panel})

    def stop(self):
        self.is_running = False
