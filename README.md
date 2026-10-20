# Defensa 1807

Prototipo de juego de estrategia por turnos ambientado en la Defensa de Buenos Aires (julio de 1807), en el casco histórico alrededor de la Plaza Mayor y la calle Defensa. Se juega en el navegador, pensado para celular. Vista 3D con figuras provisorias; el mapa es una grilla esquemática.

Jugar: https://franciscocarloserra.github.io/defensa-1807/

<img width="1366" height="1329" alt="Screenshot_20261020_113241" src="https://github.com/user-attachments/assets/36e377c9-bcd3-4042-906e-0fa36a1f896a" />

Local (con log de errores del front en `/tmp/defensa1807-console.jsonl`):

    python3 tools/serve.py 7807

Tres bandos en el mismo dispositivo, por turnos: Ingleses, Granaderos y Criollos (estos dos aliados). Los ingleses ganan si terminan su turno ocupando el Fuerte y el Cabildo; los defensores, si resisten 20 turnos o rinden a todos.

En el celu: un dedo mueve el mapa, dos dedos hacen zoom y giran, tocar selecciona.

Limitaciones: mapa aproximado, a reemplazar con la traza de planos de época en `data/`. Sin IA, sin sonido, sin guardado.
