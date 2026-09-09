// Relevo (bounce) para "Sign in with Apple" en Dextor Windows/Linux.
//
// Apple exige que el redirect_uri sea HTTPS (no acepta http://127.0.0.1
// como sí acepta Google) y, cuando se pide id_token, entrega la
// respuesta por POST (response_mode=form_post) — un archivo estático no
// puede recibir eso. Esta ruta puntual recibe ese POST, y redirige (302)
// al servidor local temporal que la app de escritorio ya tiene
// escuchando en 127.0.0.1 — el puerto viaja adentro del parámetro
// `state` que la propia app generó antes de abrir el navegador (formato
// "<puerto>.<token aleatorio>"), así que no hace falta guardar nada acá.
//
// Todo lo demás (cualquier otra ruta) sigue sirviéndose igual que antes,
// como sitio estático (el build web de Dextor).
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth/apple-callback' && request.method === 'POST') {
      return handleAppleCallback(request);
    }

    return env.ASSETS.fetch(request);
  },
};

async function handleAppleCallback(request) {
  let form;
  try {
    form = await request.formData();
  } catch (e) {
    return new Response('Solicitud inválida', { status: 400 });
  }

  const state = form.get('state') || '';
  const puerto = (state.split('.')[0] || '').replace(/\D/g, '');

  if (!puerto) {
    return new Response(
      'No se pudo identificar la sesión de login (falta el puerto en state). ' +
        'Volvé a intentar el login desde Dextor.',
      { status: 400 },
    );
  }

  const destino = new URL(`http://127.0.0.1:${puerto}/`);
  if (form.get('error')) destino.searchParams.set('error', form.get('error'));
  if (form.get('code')) destino.searchParams.set('code', form.get('code'));
  if (form.get('id_token')) destino.searchParams.set('id_token', form.get('id_token'));
  destino.searchParams.set('state', state);

  // Un 302 directo a http://127.0.0.1 desde una página https a veces lo
  // bloquean navegadores/extensiones (mixed content en el redirect) —
  // una página intermedia con meta-refresh + link manual es más
  // confiable que depender solo del header Location.
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Dextor</title>
<meta http-equiv="refresh" content="0;url=${destino.toString()}">
<style>body{font-family:sans-serif;display:flex;align-items:center;
justify-content:center;height:100vh;margin:0;background:#1a0d3b;color:#fff}
div{text-align:center}a{color:#fff}</style></head><body><div>
<h2>Volviendo a Dextor…</h2>
<p>Si no volvés solo en un instante, <a href="${destino.toString()}">tocá acá</a>.</p>
</div></body></html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
