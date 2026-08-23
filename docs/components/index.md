# Documentação de `index.tsx`

Onboarding de permissões (US01/FR-009): justificativa clara + ênfase no
processamento local (LGPD) antes de pedir câmera, galeria e localização.

Duas classes de permissão, de propósito:

- **Bloqueantes** — câmera. Sem ela o visor não abre, e o gate segura aqui.
- **Best-effort** — galeria (no Expo Go o expo-media-library rejeita toda
chamada com 'unavailable') e **localização** (feature 005).

A localização é pedida junto das outras (decisão do Sávio, 2026-08-22) mas
**nunca entra no gate**: recusar o lugar não pode impedir alguém de usar o
app. Sem ela, a vibe é lida só da imagem e da hora — que é exatamente o
comportamento que FR-034 descreve para o caso de permissão negada.

