"""Offline behavioral tests: fake external services, real casting and directing code."""
import asyncio
import sys
import types
import unittest
from unittest.mock import AsyncMock, patch

config = types.ModuleType('agents.config')
config.ANTHROPIC_API_KEY = config.OPENAI_API_KEY = ''
config.SHOWRUNNER_MODELS = ['test-model']
config.CHARACTER_VOICES = ['fable', 'onyx', 'echo', 'nova', 'alloy', 'shimmer']
sys.modules['agents.config'] = config
sys.modules['anthropic'] = types.ModuleType('anthropic')
sys.modules['openai'] = types.ModuleType('openai')
art = types.ModuleType('agents.art_director')
art.ArtDirectorAgent = type('ArtDirectorAgent', (), {})
sys.modules['agents.art_director'] = art

from agents.showrunner import ShowrunnerAgent
from agents.character import CharacterAgent
from agents.orchestrator import EpisodeOrchestrator


class DirectingTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.showrunner = ShowrunnerAgent()

    async def test_six_distinct_characters_and_guest_in_every_scene(self):
        for show in ('The Office', 'Seinfeld'):
            bible = await self.showrunner.develop_episode(show, 'A broken coffee maker', 'Cleopatra')
            self.assertEqual(len(bible['characters']), 6)
            self.assertEqual(sum(c['cast_role'] == 'regular' for c in bible['characters']), 5)
            self.assertEqual(bible['characters'][-1]['name'], 'Cleopatra')
            self.assertEqual(len({c['id'] for c in bible['characters']}), 6)
            self.assertEqual(len({c['voice_id'] for c in bible['characters']}), 6)
            for scene in bible['scenes']:
                self.assertEqual(len(scene['participating_characters']), 6)
                self.assertIn('Cleopatra', scene['director_notes'])

    async def test_repeat_cut_without_network(self):
        result = await self.showrunner.review_line({}, {}, [{'speech': 'This printer is plotting against us!'}], {}, {'speech': 'This printer is plotting against us.'})
        self.assertTrue(result['redo'])
        self.assertIn('new action', result['direction'])

    async def test_remote_semantic_review_and_failure(self):
        create = AsyncMock(return_value=types.SimpleNamespace(content=[types.SimpleNamespace(text='{"redo": true, "reason": "Unrelated tangent", "direction": "Cut! Return to the printer."}')]))
        self.showrunner.client = types.SimpleNamespace(messages=types.SimpleNamespace(create=create))
        result = await self.showrunner.review_line({}, {}, [], {}, {'speech': 'Let us discuss yacht insurance.'})
        self.assertTrue(result['redo'])
        self.assertIn('intentional', create.call_args.kwargs['system'])
        create.side_effect = TimeoutError()
        result = await self.showrunner.review_line({}, {}, [], {}, {'speech': 'Fresh beat'})
        self.assertTrue(result['review_unavailable'])

    async def test_actor_receives_retake_notes_and_rejected_take(self):
        actor = CharacterAgent({'id': 'guest', 'name': 'Cleopatra'}, 'The Office')
        create = AsyncMock(return_value=types.SimpleNamespace(choices=[types.SimpleNamespace(message=types.SimpleNamespace(content='{"speech": "The printer now demands tribute."}'))]))
        actor.openai_client = types.SimpleNamespace(chat=types.SimpleNamespace(completions=types.SimpleNamespace(create=create)))
        await actor.speak({}, [], [], director_feedback='Use your royal authority.', rejected_takes=['Old joke'])
        prompt = create.call_args.kwargs['messages'][1]['content']
        self.assertIn('Use your royal authority.', prompt)
        self.assertIn('Old joke', prompt)

    async def run_episode(self, always_reject=False):
        events = []
        async def emit(event):
            events.append(event)
        engine = EpisodeOrchestrator(emit)
        bible = await self.showrunner.develop_episode('The Office', '', 'Cleopatra')
        bible['scenes'] = bible['scenes'][:1]
        engine.showrunner.develop_episode = AsyncMock(return_value=bible)
        async def review(bible, scene, history, actor, line):
            return {'redo': always_reject or line['speech'] == 'Rejected draft', 'direction': 'Bring in a new prop.', 'reason': 'Repeated joke'}
        engine.showrunner.review_line = review
        engine._generate_and_emit_storyboard = AsyncMock()
        async def speak(actor, **kwargs):
            return {'speech': 'Approved ' + actor.name if kwargs.get('director_feedback') else 'Rejected draft'}
        with patch.object(CharacterAgent, 'speak', speak), patch('agents.orchestrator.asyncio.sleep', new=AsyncMock()):
            await engine.run_episode('The Office', '', lines_per_scene=1, guest_name='Cleopatra')
        return events

    async def test_retake_replaces_draft_and_every_actor_speaks(self):
        events = await self.run_episode()
        lines = [e['data'] for e in events if e['type'] == 'dialogue_line']
        self.assertEqual(len(lines), 6)
        self.assertEqual(len({l['speaker_id'] for l in lines}), 6)
        self.assertIn('Cleopatra', [l['speaker_name'] for l in lines])
        self.assertTrue(all(l['take'] == 2 for l in lines))
        self.assertTrue(all(l['speech'].startswith('Approved') for l in lines))
        self.assertEqual(sum(e['type'] == 'showrunner_cut' for e in events), 6)

    async def test_retry_limit_never_publishes_rejected_line(self):
        events = await self.run_episode(always_reject=True)
        self.assertFalse(any(e['type'] == 'dialogue_line' for e in events))
        cuts = [e['data'] for e in events if e['type'] == 'showrunner_cut']
        self.assertEqual(len(cuts), 18)
        self.assertEqual(sum(c['final_attempt'] for c in cuts), 6)
        self.assertEqual(events[-1]['type'], 'artwork_complete')
        self.assertTrue(any(e['type'] == 'episode_complete' for e in events))

if __name__ == '__main__':
    unittest.main(verbosity=2)
