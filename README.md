# LiveTV

Aplicação Android de testes IPTV/M3U independente da **TV do Zé** principal.

## Objetivo

- usar a playlist base do projeto [LITUATUI/M3UPT](https://github.com/LITUATUI/M3UPT);
- reproduzir HLS (`.m3u8`) e MPEG-DASH (`.mpd`);
- usar **Shaka Player** como motor web principal;
- manter a app completamente separada do package/update channel da TV do Zé;
- preservar metadados M3U como `tvg-id`, `tvg-logo`, `group-title`, `http-referrer`, `http-origin`, `user-agent` e `KODIPROP` quando aplicável.

## Arquitetura prevista

- `android/` — shell Android independente;
- `web/` — UI/player local baseado em Shaka Player;
- `playlist/` — snapshot/build tooling para M3UPT;
- `.github/workflows/` — build APK e atualização do snapshot da playlist.

O Shaka Player é consumido como dependência/upstream em vez de copiar todo o respetivo repositório para aqui.

## Isolamento

Este projeto terá um `applicationId` próprio e não deve instalar por cima nem atualizar a aplicação principal TV do Zé.
