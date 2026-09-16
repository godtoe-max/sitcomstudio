import ast,hashlib,logging,tempfile,types,unittest
from pathlib import Path
from unittest.mock import AsyncMock

class SpeechTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        source=ast.parse((Path(__file__).parent/'server.py').read_text(encoding='utf-8'))
        handler=next(n for n in source.body if isinstance(n,ast.AsyncFunctionDef) and n.name=='synthesize_speech')
        handler.decorator_list=[]
        self.create=AsyncMock(return_value=types.SimpleNamespace(content=b'ID3-real-ai-clip'))
        self.env=dict(TTSRequest=object,hashlib=hashlib,TTS_MODEL='gpt-4o-mini-tts',
                      CHARACTER_VOICES=['fable','onyx','echo','nova','alloy','shimmer'],
                      AUDIO_CACHE_DIR=Path(self.tmp.name),logger=logging.getLogger('test'),
                      openai_client=types.SimpleNamespace(audio=types.SimpleNamespace(speech=types.SimpleNamespace(create=self.create))))
        exec(compile(ast.Module(body=[handler],type_ignores=[]),'server.py','exec'),self.env)
    async def test_ai_model_direction_and_cached_clip(self):
        request=types.SimpleNamespace(text='The printer wants a raise.',voice='echo',speaker_name='Jim')
        result=await self.env['synthesize_speech'](request)
        self.assertEqual(result['status'],'ok')
        self.assertEqual(self.create.call_args.kwargs['model'],'gpt-4o-mini-tts')
        self.assertIn('deadpan',self.create.call_args.kwargs['instructions'])
        result=await self.env['synthesize_speech'](request)
        self.assertTrue(result['cached']);self.assertEqual(self.create.await_count,1)
    async def test_no_credits_returns_error_not_fallback(self):
        error=Exception('No credits');error.status_code=429;self.create.side_effect=error
        result=await self.env['synthesize_speech'](types.SimpleNamespace(text='Hello',voice='fable',speaker_name='Guest'))
        self.assertEqual(result['status'],'error');self.assertIn('credits',result['message'])

if __name__=='__main__': unittest.main(verbosity=2)
