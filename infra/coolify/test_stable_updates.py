import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('updates',Path(__file__).with_name('stable-updates.py'))
updates=importlib.util.module_from_spec(spec);spec.loader.exec_module(updates)

class StableUpdatesTest(unittest.TestCase):
    def test_rejects_prerelease_even_from_latest_endpoint(self):
        response=io.StringIO(json.dumps({'tag_name':'v3.4.6','prerelease':True,'draft':False}))
        with patch.object(updates.urllib.request,'urlopen',return_value=response):
            with self.assertRaises(ValueError): updates.stable('owner/repo')

    def test_image_must_match_the_published_release(self):
        inspect=json.dumps([{'RepoDigests':['owner/image@sha256:abc']}])
        with patch.object(updates,'run',side_effect=['',inspect,'ai-memory 3.4.5']):
            with self.assertRaises(RuntimeError): updates.candidate('akitaonrails/ai-memory:latest','3.4.6')

    def test_rejects_version_prefix_as_a_match(self):
        inspect=json.dumps([{'RepoDigests':['owner/image@sha256:abc']}])
        with patch.object(updates,'run',side_effect=['',inspect,'ai-memory 3.4.60']):
            with self.assertRaises(RuntimeError): updates.candidate('akitaonrails/ai-memory:latest','3.4.6')

    def test_refuses_restore_outside_the_two_data_directories(self):
        with patch.object(updates,'run') as command:
            with self.assertRaises(RuntimeError): updates.restore(Path('/'),Path('/tmp/test.tar.gz'),'test')
            command.assert_not_called()

if __name__=='__main__': unittest.main()