import json
import logging
from typing import Dict, Any, List, Optional
import openai
import anthropic
from .config import OPENAI_API_KEY, ANTHROPIC_API_KEY

logger = logging.getLogger("sitcom.character")

CHARACTER_SPEAK_PROMPT = """You are acting as {character_name} in an episode of the sitcom "{show_title}".
YOUR CHARACTER PROFILE:
- Personality: {personality}
- Voice & Mannerisms: {speech_mannerisms}
- Your Episode Goal: {episode_goal}
- Relationships to others present: {relationships_json}

CURRENT SCENE CONTEXT:
- Scene: {scene_title}
- Location: {location}
- Director Notes: {director_notes}

DIALOGUE SO FAR IN THIS SCENE:
{dialogue_history}

TASK:
Deliver your next line of dialogue in character. Stay true to your comedic quirks, flaws, and timing.
React to the previous speaker with authentic banter, comedic escalation, denial, or absurdity.

You must respond in raw JSON format with these exact fields:
{{
  "inner_thought": "Your private, candid internal monologue about what just happened and your strategy right now (1-2 sentences)",
  "stage_direction": "Physical comedic action or camera cue in brackets, e.g. [glances nervously at the door] or [slams coffee mug down]",
  "speech": "What you say aloud to the other characters",
  "audience_reaction": "One of: [Laugh Track: Mild], [Laugh Track: Big], [Audience: Groan], [Audience: Ooooh], [Audience: Cheers], [Awkward Silence], [None]"
}}
"""

class CharacterAgent:
    def __init__(self, char_data: Dict[str, Any], show_title: str):
        self.id = char_data["id"]
        self.name = char_data["name"]
        self.personality = char_data.get("personality", "")
        self.speech_mannerisms = char_data.get("speech_mannerisms", "")
        self.episode_goal = char_data.get("episode_goal", "")
        self.relationships = char_data.get("relationships", {})
        self.avatar_color = char_data.get("avatar_color", "#4F46E5")
        self.voice_id = char_data.get("voice_id", "fable")
        self.show_title = show_title
        
        self.openai_client = openai.AsyncOpenAI(api_key=OPENAI_API_KEY, max_retries=0) if OPENAI_API_KEY else None
        self.anthropic_client = anthropic.AsyncAnthropic(api_key=ANTHROPIC_API_KEY, max_retries=1) if ANTHROPIC_API_KEY else None
        self.line_count = 0

    async def speak(
        self,
        scene_info: Dict[str, Any],
        dialogue_history: List[Dict[str, str]],
        other_characters: List[str],
        director_feedback: str = "",
        rejected_takes: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Generates in-character dialogue with stage directions, audience cues, and private inner monologue.
        Uses OpenAI GPT-4o with automatic fallback to Anthropic Claude Haiku 4.5.
        """
        formatted_history = "\n".join([
            f"{line.get('speaker', 'Unknown')}: {line.get('speech', '')}"
            for line in dialogue_history[-8:]
        ]) if dialogue_history else "(The scene has just begun. Establish the beat.)"

        prompt = CHARACTER_SPEAK_PROMPT.format(
            character_name=self.name,
            show_title=self.show_title,
            personality=self.personality,
            speech_mannerisms=self.speech_mannerisms,
            episode_goal=self.episode_goal,
            relationships_json=json.dumps(self.relationships),
            scene_title=scene_info.get("title", "Current Scene"),
            location=scene_info.get("location", "Main Set"),
            director_notes=scene_info.get("director_notes", ""),
            dialogue_history=formatted_history
        )

        prompt += "\nScene hook: " + scene_info.get("scene_hook", "")
        prompt += "\nOther actors present: " + ", ".join(other_characters)
        if director_feedback:
            prompt += "\nDIRECTOR CALLS FOR A RETAKE: " + director_feedback
            prompt += "\nDiscard these takes; do not repeat them: " + json.dumps(rejected_takes or [])
            prompt += "\nReplace your line, keeping the accepted dialogue intact. Add a new beat."

        # 1. Try OpenAI GPT-4o if available
        if self.openai_client:
            try:
                response = await self.openai_client.chat.completions.create(
                    model="gpt-4o",
                    messages=[
                        {"role": "system", "content": "You are a professional sitcom actor improvising comedic dialogue with strict character integrity. Respond in valid JSON."},
                        {"role": "user", "content": prompt}
                    ],
                    max_tokens=350,
                    response_format={"type": "json_object"}
                )
                raw = response.choices[0].message.content.strip()
                result = json.loads(raw)
                result["speaker_id"] = self.id
                result["speaker_name"] = self.name
                result["avatar_color"] = self.avatar_color
                result["voice_id"] = self.voice_id
                self.line_count += 1
                return result
            except Exception as e:
                logger.warning(f"OpenAI error for {self.name}: {e}. Trying Anthropic Claude Haiku...")

        # 2. Fallback to Anthropic Claude Haiku 4.5
        if self.anthropic_client:
            try:
                resp = await self.anthropic_client.messages.create(
                    model="claude-haiku-4-5-20251001",
                    max_tokens=400,
                    messages=[
                        {"role": "user", "content": prompt + "\nOutput strictly raw JSON with no backticks."}
                    ]
                )
                raw_text = resp.content[0].text.strip()
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]
                result = json.loads(raw_text.strip())
                result["speaker_id"] = self.id
                result["speaker_name"] = self.name
                result["avatar_color"] = self.avatar_color
                result["voice_id"] = self.voice_id
                self.line_count += 1
                return result
            except Exception as e:
                logger.error(f"Anthropic error for {self.name}: {e}")

        # 3. Emergency comedic template
        return self._fallback_line(dialogue_history)

    def _fallback_line(self, dialogue_history: List[Dict[str, str]]) -> Dict[str, Any]:
        """Graceful fallback if all API calls fail."""
        return {
            "speaker_id": self.id,
            "speaker_name": self.name,
            "avatar_color": self.avatar_color,
            "voice_id": self.voice_id,
            "inner_thought": f"I need to protect my interests here before this gets further out of hand.",
            "stage_direction": "[pauses and looks intensely at the room]",
            "speech": f"Hold on. Are we really going to pretend this isn't completely insane?",
            "audience_reaction": "[Laugh Track: Mild]"
        }
