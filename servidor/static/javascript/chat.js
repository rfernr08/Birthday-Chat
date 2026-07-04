let codigoActual = "";
let aliasActual = "";
let canalActual = "";
let websocket = null;

let listaGlobalDeAlias = new Set(); 
let quoteActivo = null;             
let indexAutocompleteSeleccionado = 0;

// Escucha para el envío por Enter en la pantalla de login
document.getElementById("input-codigo").addEventListener("keypress", (e) => { 
    if(e.key === 'Enter') procesarLogin(); 
});

function reproducirSonidoPing() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine"; 
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(); osc.stop(ctx.currentTime + 0.15);
    } catch(e) {}
}

async function procesarLogin() {
    const codigo = document.getElementById("input-codigo").value.trim();
    const errorDiv = document.getElementById("error-login");
    if (!codigo) return;

    try {
        const respuesta = await fetch("/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: codigo })
        });

        if (respuesta.status === 200) {
            const datos = await respuesta.json();
            codigoActual = codigo;
            aliasActual = datos.alias;
            
            document.getElementById("pantalla-login").style.display = "none";
            document.getElementById("interfaz-chat").style.display = "flex";
            document.getElementById("txt-perfil").innerText = `AGENTE: ${aliasActual}`;
            
            const contenedor = document.getElementById("contenedor-canales");
            contenedor.innerHTML = "";
            datos.canales.forEach(canal => {
                const btn = document.createElement("button");
                btn.className = "btn-canal";
                btn.innerText = canal;
                btn.onclick = () => cambiarCanal(canal, btn);
                contenedor.appendChild(btn);
            });
        } else { errorDiv.innerText = "Código incorrecto."; }
    } catch (err) { errorDiv.innerText = "Error de conexión."; }
}

async function cambiarCanal(canalDestino, botonPresionado) {
    if (canalActual === canalDestino) return;
    canalActual = canalDestino;
    cancelarRespuesta();

    document.getElementById("titulo-canal").innerText = `Conectado a ${canalDestino}`;
    document.querySelectorAll(".btn-canal").forEach(b => b.classList.remove("activo"));
    botonPresionado.classList.add("activo");

    const historialDiv = document.getElementById("historial");
    historialDiv.innerHTML = `<div class="linea-mensaje tag-sistema">Cargando historial seguro de ${canalDestino}...</div>`;

    document.getElementById("input-mensaje").disabled = false;
    document.getElementById("btn-enviar").disabled = false;
    document.getElementById("btn-clip").disabled = false;
    document.getElementById("input-mensaje").focus();

    try {
        const res = await fetch(`/historial/${encodeURIComponent(canalDestino)}`);
        if (res.status === 200) {
            const mensajes = await res.json();
            historialDiv.innerHTML = ""; 
            mensajes.forEach(msg => {
                try {
                    const estrucutraJSON = JSON.parse(msg.contenido);
                    insertarMensajeEnPantalla(msg.alias, estrucutraJSON.texto, false, estrucutraJSON.quote_info);
                } catch(e) {
                    insertarMensajeEnPantalla(msg.alias, msg.contenido, false, null);
                }
            });
            historialDiv.scrollTop = historialDiv.scrollHeight;
        }
    } catch (e) { console.error(e); }

    if (websocket) { websocket.close(); }

    const protocoloWS = window.location.protocol === "https:" ? "wss://" : "ws://";
    const uriWS = `${protocoloWS}${window.location.host}/ws/${encodeURIComponent(canalDestino)}/${codigoActual}`;

    websocket = new WebSocket(uriWS);

    websocket.onmessage = (evento) => {
        const msg = JSON.parse(evento.data);
        if (msg.sistema) {
            insertarSistemaEnPantalla(msg.contenido);
        } else {
            try {
                const estructuraJSON = JSON.parse(msg.contenido);
                insertarMensajeEnPantalla(msg.alias, estructuraJSON.texto, true, estructuraJSON.quote_info);
            } catch(e) {
                insertarMensajeEnPantalla(msg.alias, msg.contenido, true, null);
            }
        }
        historialDiv.scrollTop = historialDiv.scrollHeight;
    };
}

function activarRespuesta(aliasMensaje, textoOriginal) {
    let resumen = textoOriginal.startsWith("/uploads/") ? "[Archivo Adjunto]" : textoOriginal;
    if (resumen.length > 40) resumen = resumen.substring(0, 40) + "...";

    quoteActivo = { alias: aliasMensaje, fragmento: resumen };
    
    document.getElementById("txt-reply-info").innerHTML = `Respondiendo a <span>@${aliasMensaje}</span>: "${resumen}"`;
    document.getElementById("barra-reply").style.display = "flex";
    document.getElementById("input-mensaje").focus();
}

function cancelarRespuesta() {
    quoteActivo = null;
    document.getElementById("barra-reply").style.display = "none";
}

function enviarMensaje() {
    const input = document.getElementById("input-mensaje");
    const mensaje = input.value.trim();
    if (mensaje && websocket && websocket.readyState === WebSocket.OPEN) {
        
        if (quoteActivo) {
            const payload = {
                texto: mensaje,
                quote_info: quoteActivo
            };
            websocket.send(JSON.stringify(payload));
            cancelarRespuesta();
        } else {
            websocket.send(mensaje);
        }
        
        input.value = "";
        input.focus();
    }
}

async function subirYEnviarArchivo() {
    const selector = document.getElementById("selector-archivos");
    if (selector.files.length === 0) return;

    const archivo = selector.files[0];
    const formData = new FormData();
    formData.append("file", archivo);

    try {
        const respuesta = await fetch("/upload-archivo", { method: "POST", body: formData });
        if (respuesta.ok) {
            const datos = await respuesta.json();
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                if (quoteActivo) {
                    const payload = { texto: datos.url, quote_info: quoteActivo };
                    websocket.send(JSON.stringify(payload));
                    cancelarRespuesta();
                } else {
                    websocket.send(datos.url);
                }
            }
        }
    } catch (e) { alert("Error."); }
    selector.value = "";
}

function insertarMensajeEnPantalla(alias, contenido, activarEfectosEnVivo, infoDeLaRespuesta) {
    if(alias !== aliasActual) listaGlobalDeAlias.add(alias);

    const historialDiv = document.getElementById("historial");
    const div = document.createElement("div");
    div.className = "linea-mensaje";

    const claseAlias = (alias === aliasActual) ? "alias-propio" : "alias-ajeno";
    
    let contenidoRenderizado = contenido;
    if (contenido.startsWith("/uploads/")) {
        const ext = contenido.split('.').pop().toLowerCase();
        if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
            contenidoRenderizado = `<br><img src="${contenido}" class="chat-imagen" onclick="window.open('${contenido}', '_blank')">`;
        } else if (["mp4", "webm", "ogg"].includes(ext)) {
            contenidoRenderizado = `<br><video src="${contenido}" controls class="chat-imagen" style="max-width: 400px; max-height: 250px;"></video>`;
        } else {
            const nombreArchivo = contenido.substring(9);
            contenidoRenderizado = `<br><a href="${contenido}" download class="chat-archivo">📂 Descargar: ${nombreArchivo}</a>`;
        }
    }

    let htmlQuote = "";
    if (infoDeLaRespuesta) {
        htmlQuote = `<div class="bloque-quote-renderizado">↩️ @${infoDeLaRespuesta.alias}: ${infoDeLaRespuesta.fragmento}</div>`;
    }

    const contenidoSeguroParaBoton = contenido.replace(/['"]/g, ' ');

    div.innerHTML = `
        ${htmlQuote}
        <div>
            <span class="${claseAlias}">[${alias}]:</span> ${contenidoRenderizado}
        </div>
        <button class="btn-reply-trigger" onclick="activarRespuesta('${alias}', '${contenidoSeguroParaBoton}')">↩ Responder</button>
    `;
    
    const teHanMencionadoPorTexto = contenido.includes(`@${aliasActual}`);
    const teHanRespondidoAUnMensaje = infoDeLaRespuesta && infoDeLaRespuesta.alias === aliasActual;

    if ((teHanMencionadoPorTexto || teHanRespondidoAUnMensaje) && alias !== aliasActual) {
        div.classList.add("pingeado");
        if (activarEfectosEnVivo) {
            reproducirSonidoPing();
        }
    }
    
    historialDiv.appendChild(div);
}

function insertarSistemaEnPantalla(contenido) {
    const historialDiv = document.getElementById("historial");
    const div = document.createElement("div");
    div.className = "linea-mensaje tag-sistema";
    div.innerText = contenido;
    historialDiv.appendChild(div);
}

// ─── MOTOR DE AUTOCOMPLETADO DE @ALIAS ───
function manejarFiltroAutocomplete(input) {
    const texto = input.value;
    const cajaDropdown = document.getElementById("box-autocomplete");
    const ultimaArrobaIndex = texto.lastIndexOf("@");
    
    if (ultimaArrobaIndex !== -1 && ultimaArrobaIndex >= texto.lastIndexOf(" ")) {
        const queryBusqueda = texto.substring(ultimaArrobaIndex + 1).toLowerCase();
        const coincidencias = Array.from(listaGlobalDeAlias).filter(a => a.toLowerCase().startsWith(queryBusqueda));
        
        if (coincidencias.length > 0) {
            indexAutocompleteSeleccionado = 0;
            cajaDropdown.innerHTML = "";
            cajaDropdown.style.display = "flex";
            
            coincidencias.forEach((aliasCoincidente, i) => {
                const item = document.createElement("div");
                item.className = "opcion-autocomplete" + (i === 0 ? " seleccionada" : "");
                item.innerText = `@${aliasCoincidente}`;
                item.onclick = () => aplicarSustitucionAutocomplete(aliasCoincidente);
                cajaDropdown.appendChild(item);
            });
            return;
        }
    }
    cajaDropdown.style.display = "none";
}

function manejarTeclasAutocomplete(evento) {
    const cajaDropdown = document.getElementById("box-autocomplete");
    
    if (cajaDropdown.style.display !== "flex") {
        if (evento.key === 'Enter') enviarMensaje();
        return;
    }

    const opciones = cajaDropdown.querySelectorAll(".opcion-autocomplete");

    if (evento.key === "ArrowDown") {
        evento.preventDefault();
        opciones[indexAutocompleteSeleccionado].classList.remove("seleccionada");
        indexAutocompleteSeleccionado = (indexAutocompleteSeleccionado + 1) % opciones.length;
        opciones[indexAutocompleteSeleccionado].classList.add("seleccionada");
    } 
    else if (evento.key === "ArrowUp") {
        evento.preventDefault();
        opciones[indexAutocompleteSeleccionado].classList.remove("seleccionada");
        indexAutocompleteSeleccionado = (indexAutocompleteSeleccionado - 1 + opciones.length) % opciones.length;
        opciones[indexAutocompleteSeleccionado].classList.add("seleccionada");
    } 
    else if (evento.key === "Enter" || evento.key === "Tab") {
        evento.preventDefault();
        if (opciones[indexAutocompleteSeleccionado]) {
            const seleccionado = opciones[indexAutocompleteSeleccionado].innerText.substring(1);
            aplicarSustitucionAutocomplete(seleccionado);
        }
    }
    else if (evento.key === "Escape") {
        cajaDropdown.style.display = "none";
    }
}

function aplicarSustitucionAutocomplete(aliasElegido) {
    const input = document.getElementById("input-mensaje");
    const texto = input.value;
    const ultimaArrobaIndex = texto.lastIndexOf("@");
    
    input.value = texto.substring(0, ultimaArrobaIndex) + `@${aliasElegido} `;
    document.getElementById("box-autocomplete").style.display = "none";
    input.focus();
}