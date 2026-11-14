import importlib.util
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('exporter', Path(__file__).with_name('export-status.py'))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportStatusTest(unittest.TestCase):
    def test_deployments_never_include_logs_or_credentials(self):
        result = exporter.deployments({'deployments': [{'commit': 'abc', 'status': 'finished', 'token': 'secret', 'logs': 'secret'}]})
        self.assertNotIn('secret', str(result))
        self.assertEqual(result[0]['commit'], 'abc')

    def test_disabled_timer_is_reported_without_failing_collection(self):
        with patch.object(exporter.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, 'disabled\n')):
            self.assertFalse(exporter.enabled())

    def test_systemd_time_is_exported_as_utc_for_the_ui(self):
        self.assertEqual(exporter.date('Sat 2026-11-14 07:06:04 UTC'), '2026-11-14T07:06:04+00:00')
        self.assertIsNone(exporter.date(''))
