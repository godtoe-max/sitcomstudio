import unittest,types,sys,tempfile
from pathlib import Path
from unittest.mock import AsyncMock
import xml.etree.ElementTree as ET
from urllib.parse import unquote
config=types.ModuleType('agents.config')
config.ANTHROPIC_API_KEY=''
config.ART_MODEL='test-model'
scratch=tempfile.TemporaryDirectory()
config.IMAGE_CACHE_DIR=Path(scratch.name)
sys.modules['agents.config']=config
sys.modules['anthropic']=types.ModuleType('anthropic')
from agents.art_director import ArtDirectorAgent,validate_svg
SVG='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 540"><rect width="960" height="540" fill="#123456"/><circle cx="100" cy="100" r="20"/></svg>'
def response(text,stop='end_turn'):
 return types.SimpleNamespace(content=[types.SimpleNamespace(text=text)],stop_reason=stop)
class ImageTests(unittest.IsolatedAsyncioTestCase):
 def setUp(self):self.agent=ArtDirectorAgent()
 async def test_claude_svg_is_saved_as_local_illustration(self):
  create=AsyncMock(return_value=response(SVG))
  self.agent.client=types.SimpleNamespace(messages=types.SimpleNamespace(create=create))
  result=await self.agent.generate_storyboard_panel(1,'Read','Office','Six actors reading','Test Show')
  self.assertFalse(result['is_fallback']);self.assertEqual(result['art_provider'],'anthropic')
  p=config.IMAGE_CACHE_DIR/Path(result['image_url']).name
  self.assertEqual(p.suffix,'.svg');ET.fromstring(p.read_text())
  self.assertEqual(create.call_args.kwargs['model'],'test-model')
 async def test_malformed_svg_is_repaired_once(self):
  create=AsyncMock(side_effect=[response('<svg>'),response(SVG)])
  self.agent.client=types.SimpleNamespace(messages=types.SimpleNamespace(create=create))
  result=await self.agent.generate_storyboard_panel(1,'Read','Office','Cast','Test')
  self.assertFalse(result['is_fallback']);self.assertEqual(create.await_count,2)
 async def test_truncation_returns_visible_error_after_bounded_retry(self):
  create=AsyncMock(return_value=response(SVG,'max_tokens'))
  self.agent.client=types.SimpleNamespace(messages=types.SimpleNamespace(create=create))
  result=await self.agent.generate_storyboard_panel(1,'Read','Office','Cast','Test')
  self.assertTrue(result['is_fallback']);self.assertIn('error',result);self.assertEqual(create.await_count,2)
 async def test_failed_generation_has_anthropic_error(self):
  error=Exception('No credits');error.status_code=429
  self.agent.client=types.SimpleNamespace(messages=types.SimpleNamespace(create=AsyncMock(side_effect=error)))
  result=await self.agent.generate_storyboard_panel(1,'Read','Office','Cast','Test')
  self.assertIn('Anthropic',result['error'])
 async def test_missing_key_does_not_pretend_to_generate(self):
  result=await self.agent.generate_storyboard_panel(1,'Read','Office','Cast','Test')
  self.assertIn('Anthropic API key',result['error'])
 def test_svg_rejects_scripts_events_and_external_resources(self):
  for content in ['<script>alert(1)</script>','<rect onclick="evil()"/>','<image href="https://example.com/a.png"/>','<rect fill="url(https://example.com)"/>']:
   with self.assertRaises(ValueError):validate_svg('<svg xmlns="http://www.w3.org/2000/svg">'+content+'</svg>')
 def test_fenced_svg_and_local_gradients_are_supported(self):
  ET.fromstring(validate_svg('```svg\n'+SVG+'\n```'))
  ET.fromstring(validate_svg(SVG.replace('fill="#123456"','fill="url(#gradient)"')))
 def test_ampersand_title_placeholder_is_valid_svg(self):
  panel=self.agent._create_stylized_svg_fallback(1,'A < B','Office & Hall','Quoted caption','Parks & Recreation')
  ET.fromstring(unquote(panel['image_url'].split(',',1)[1]))
if __name__=='__main__':unittest.main(verbosity=2)
