import copy
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

script = Path(__file__).resolve().parents[1] / 'scripts' / 'telegram_bot.py'
if not script.exists():
    script = Path(__file__).with_name('telegram_bot.py')
spec = importlib.util.spec_from_file_location('bot', script)
bot = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bot)


class Commands(unittest.TestCase):
    def setUp(self):
        self.config = {'destinos': {'hubTS': 'https://t.me/+Original'}, 'enviarOrigemAoBot': False}
        silence = patch.object(bot, 'print', create=True)
        silence.start()
        self.addCleanup(silence.stop)

    def run_command(self, text):
        return bot.command(self.config, text, 'https://example.com/', 'managerseo3_bot')

    def test_invite_and_case_preserved(self):
        result, reply = self.run_command('/destino hubTS https://t.me/+Novo')
        self.assertEqual(result['destinos']['hubTS'], 'https://t.me/+Novo')
        self.assertIn('?bot=hubTS', reply)
        self.assertEqual(self.config['destinos']['hubTS'], 'https://t.me/+Original')

    def test_create_and_duplicate_protection(self):
        result, _ = self.run_command('/criar loiras https://t.me/ExemploBot?start=abc')
        self.assertEqual(result['destinos']['loiras'], 'https://t.me/ExemploBot?start=abc')
        result, reply = self.run_command('/criar hubTS https://t.me/Outra')
        self.assertEqual(result, self.config)
        self.assertIn('já existe', reply)

    def test_invalid_destinations_do_not_mutate(self):
        for value in ['http://t.me/a', 'https://t.me.evil.com/a', 'https://t.me@evil.com/a',
                      'javascript:alert(1)', 'https://t.me/', 'https://t.me:443/a', 'https://t.me/a\\b']:
            with self.subTest(value=value):
                result, reply = self.run_command('/destino hubTS ' + value)
                self.assertEqual(result, self.config)
                self.assertIn('inválido', reply)

    def test_invalid_names_and_unknown_update(self):
        for value in ['../a', 'a/b', 'á', 'a' * 65, '__proto__']:
            result, _ = self.run_command('/destino ' + value + ' https://t.me/ExemploBot')
            self.assertEqual(result, self.config)

    def test_admin_requires_private_id(self):
        message = {'from': {'id': 123}, 'chat': {'id': 123, 'type': 'private'}}
        self.assertTrue(bot.authorized(message, '123'))
        self.assertFalse(bot.authorized(message, '456'))
        message['chat']['type'] = 'group'
        self.assertFalse(bot.authorized(message, '123'))
        self.assertFalse(bot.authorized({}, '123'))

    def test_read_commands_and_other_bot_mention(self):
        for text in ['/listar', '/start', '/link hubTS', '/link ausente', '/naoexiste']:
            result, reply = self.run_command(text)
            self.assertEqual(result, self.config)
            self.assertTrue(reply)
        result, reply = self.run_command('/destino@OutroBot hubTS https://t.me/Outro')
        self.assertEqual(result, self.config)
        self.assertIsNone(reply)

    def test_processing_persists_before_reply_and_requests_deploy(self):
        events = []
        update = {'update_id': 10, 'message': {'from': {'id': 123},
                  'chat': {'id': 123, 'type': 'private'},
                  'text': '/destino hubTS https://t.me/+Novo'}}
        env = {'TELEGRAM_BOT_TOKEN': 'test-only', 'TELEGRAM_ADMIN_ID': '123',
               'TELEGRAM_CHANNEL_ID': '-1001', 'PUBLIC_BASE_URL': 'https://example.com/'}
        with patch.dict(bot.os.environ, env), \
             patch.object(bot, 'read_json', side_effect=[copy.deepcopy(self.config), {'offset': 0, 'pending_deploy': False}]), \
             patch.object(bot, 'telegram', side_effect=[{}, {'username': 'managerseo3_bot'}, [update]]), \
             patch.object(bot, 'persist', side_effect=lambda *args: events.append(('persist', copy.deepcopy(args)))) as save, \
             patch.object(bot, 'send', side_effect=lambda *args: events.append(('send', args))), \
             patch.object(bot, 'output') as output:
            bot.process()
        self.assertEqual(events[0][0], 'persist')
        self.assertEqual(events[1][0], 'send')
        self.assertEqual(save.call_args.args[1], {'offset': 11, 'pending_deploy': True})
        output.assert_called_once_with('deploy', True)

    def test_unauthorized_update_is_only_acknowledged(self):
        update = {'update_id': 10, 'message': {'from': {'id': 999},
                  'chat': {'id': 999, 'type': 'private'},
                  'text': '/destino hubTS https://t.me/BadBot'}}
        env = {'TELEGRAM_BOT_TOKEN': 'test-only', 'TELEGRAM_ADMIN_ID': '123',
               'TELEGRAM_CHANNEL_ID': '-1001', 'PUBLIC_BASE_URL': 'https://example.com/'}
        with patch.dict(bot.os.environ, env), \
             patch.object(bot, 'read_json', side_effect=[copy.deepcopy(self.config), {'offset': 0, 'pending_deploy': False}]), \
             patch.object(bot, 'telegram', side_effect=[{}, {'username': 'managerseo3_bot'}, [update]]), \
             patch.object(bot, 'persist') as save, patch.object(bot, 'send') as send, \
             patch.object(bot, 'output'):
            bot.process()
        self.assertEqual(save.call_args.args[0], self.config)
        self.assertEqual(save.call_args.args[1]['offset'], 11)
        send.assert_not_called()

    def test_failed_save_never_confirms(self):
        update = {'update_id': 10, 'message': {'from': {'id': 123},
                  'chat': {'id': 123, 'type': 'private'},
                  'text': '/destino hubTS https://t.me/+Novo'}}
        env = {'TELEGRAM_BOT_TOKEN': 'test-only', 'TELEGRAM_ADMIN_ID': '123',
               'TELEGRAM_CHANNEL_ID': '-1001', 'PUBLIC_BASE_URL': 'https://example.com/'}
        with patch.dict(bot.os.environ, env), \
             patch.object(bot, 'read_json', side_effect=[copy.deepcopy(self.config), {'offset': 0, 'pending_deploy': False}]), \
             patch.object(bot, 'telegram', side_effect=[{}, {'username': 'managerseo3_bot'}, [update]]), \
             patch.object(bot, 'persist', side_effect=bot.SafeError('push failed')), \
             patch.object(bot, 'send') as send:
            with self.assertRaises(bot.SafeError):
                bot.process()
        send.assert_not_called()


if __name__ == '__main__':
    unittest.main()
