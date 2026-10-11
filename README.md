# Defensa 1807

Prototipo de juego de estrategia por turnos ambientado en la Defensa de Buenos Aires (julio de 1807), en el casco histórico alrededor de la Plaza Mayor y la calle Defensa. Se juega en el navegador, pensado para celular. Todavía sin gráficos: el mapa es una grilla esquemática.

Jugar: https://franciscocarloserra.github.io/defensa-1807/

Local (con log de errores del front en `/tmp/defensa1807-console.jsonl`):

    python3 serve.py 7807

Tres bandos en el mismo dispositivo, por turnos: Ingleses, Granaderos y Criollos (estos dos aliados). Los ingleses ganan si terminan su turno ocupando el Fuerte y el Cabildo; los defensores, si resisten 20 turnos o rinden a todos.

Limitaciones: mapa aproximado, a reemplazar con la traza de planos de época en `data/`. Sin IA, sin sonido, sin guardado.
