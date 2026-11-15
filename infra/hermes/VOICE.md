# Voz no Discord

A imagem precisa de `libopus0` para decodificar e reproduzir áudio. Instalar apenas
no container perde a correção na próxima recriação; mantenha a dependência no Dockerfile.

O gateway seleciona uma geração de dependências gerenciada em
`/opt/data/installs/.../environments/.../venv`. Instalar pacotes somente na
`.venv` da imagem ou em `lazy-packages` não os disponibiliza necessariamente ao
processo do gateway. Habilite os extras `stt-whisper` e `edge-tts` com o gerenciador
do Hermes, usando `enable-voice.py` como usuário `hermes`. Reinicie o gateway
depois de concluir a instalação. O estado gerenciado fica no volume persistente.

O script usa as versões e restrições declaradas pelo Hermes instalado. Não copie
wheels entre versões menores de Python: binários do Python 3.13 não funcionam no 3.14.

O Edge TTS 7.2.7 retornou HTTP 403 no teste; 7.3.1 gerou áudio corretamente.
Use `tts.provider: edge`, `tts.edge.voice: pt-BR-AntonioNeural` e
`stt.language: pt` para português. Preserve as demais opções de configuração.

Validação: carregar `discord.opus`, sintetizar uma frase e transcrever o arquivo
com `tools.transcription_tools.transcribe_audio`. Importe `hermes_cli.main` antes
de testar: esse bootstrap troca o ambiente de dependências, assim como o gateway.
Um teste sem ele pode passar enquanto o serviço retorna `No STT provider available`.
Depois, no Discord, entrar
em uma sala de voz e enviar `/voice join` no canal de texto. O teste com arquivo
valida síntese e transcrição, mas a captura do microfone exige o teste na sala.
