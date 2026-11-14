# Voz no Discord

A imagem precisa de `libopus0` para decodificar e reproduzir áudio. Instalar apenas
no container perde a correção na próxima recriação; mantenha a dependência no Dockerfile.

As dependências opcionais Python ficam em `/opt/data/lazy-packages`. Após trocar
a versão menor do Python, reinstale as dependências de `voice-requirements.txt`
com o `uv` e o interpretador da nova imagem, usando `--target /opt/data/lazy-packages
--reinstall`. Wheels do Python 3.13 não funcionam no Python 3.14, mesmo que o
diretório do pacote continue existindo. Execute como usuário `hermes`.

O Edge TTS 7.2.7 retornou HTTP 403 no teste; 7.3.1 gerou áudio corretamente.
Use `tts.provider: edge`, `tts.edge.voice: pt-BR-AntonioNeural` e
`stt.language: pt` para português. Preserve as demais opções de configuração.

Validação: carregar `discord.opus`, sintetizar uma frase e transcrever o arquivo
com `tools.transcription_tools.transcribe_audio`. Depois, no Discord, entrar
em uma sala de voz e enviar `/voice join` no canal de texto. O teste com arquivo
valida síntese e transcrição, mas a captura do microfone exige o teste na sala.
