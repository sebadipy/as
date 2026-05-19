const SmartNLPParser = {
    MONTHS: [
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    ],
    
    // Extensible properties mapping
    PROPERTIES: [
        { key: "roca", label: "Roca" },
        { key: "casa", label: "Casa" },
        { key: "dpto", label: "Dpto" },
        { key: "departamento", label: "Dpto" },
        { key: "moreno", label: "Moreno" },
        { key: "colon", label: "Colon" },
        { key: "gascon", label: "Gascon" },
        { key: "cochera26", label: "Cochera26" },
        { key: "cochera2", label: "Cochera2" },
        { key: "cochera 26", label: "Cochera26" },
        { key: "cochera 2", label: "Cochera2" }
    ],

    // Synonyms mapping for taxes/services
    SYNONYMS: {
        "edea": "Luz",
        "luz": "Luz",
        "camuzzi": "Gas",
        "gas": "Gas",
        "agua": "O.Sanitaria",
        "osn": "O.Sanitaria",
        "obras sanitarias": "O.Sanitaria",
        "cable": "Cable",
        "cablevision": "Cable",
        "flow": "Cable",
        "internet": "Cable",
        "wifi": "Cable",
        "muni": "Municipalidad",
        "municipalidad": "Municipalidad",
        "tasa": "Municipalidad",
        "tasas": "Municipalidad",
        "celular": "Celular",
        "telefono": "Celular",
        "movistar": "Celular",
        "personal": "Celular",
        "claro": "Celular",
        "peugeot": "PEUGEOT",
        "etios": "ETIOS",
        "coche": "PEUGEOT",
        "patente": "Patente",
        "seguro": "Seguro",
        "alarma": "Alarma",
        "osde": "OSDE",
        "monotributo": "MONOTRIBUTO AFIP / VEP",
        "afip": "MONOTRIBUTO AFIP / VEP",
        "vep": "MONOTRIBUTO AFIP / VEP",
        "disney": "DISNEY PLUS (COMPARTIDO)",
        "club bigua": "CLUB BIGUA",
        "bigua": "CLUB BIGUA",
        "training": "TRAINING GYM MATTEO",
        "gym": "TRAINING GYM MATTEO",
        "expensas": "Expensas",
        "expensa": "Expensas",
        "mgp": "MGP",
        "cochera": "Cochera"
    },

    parse(rawText) {
        const text = rawText.toLowerCase().trim();
        let detectedMonth = null;
        let detectedTax = null;
        let detectedAmount = null;
        let detectedProperty = null;

        // 1. Detect property (Roca, Casa, etc.)
        for (const prop of this.PROPERTIES) {
            if (text.includes(prop.key)) {
                detectedProperty = prop.label;
                break;
            }
        }

        // 2. Detect Amount (exclude years 2025, 2026, etc. to avoid false matches)
        const numbers = text.match(/\b\d+(\.\d{1,2})?\b/g);
        if (numbers) {
            const candidates = numbers.map(Number).filter(n => n !== 2025 && n !== 2026);
            if (candidates.length > 0) {
                detectedAmount = candidates[0];
            }
        }

        // 3. Detect Month
        this.MONTHS.forEach(m => {
            if (text.includes(m.toLowerCase()) || text.includes(m.substring(0, 3).toLowerCase())) {
                detectedMonth = m;
            }
        });

        // If no month is mentioned but we are searching/charging something, fallback to CURRENT month!
        const hasSomeClue = text.length > 0;
        if (!detectedMonth && hasSomeClue) {
            const currentMonthIdx = new Date().getMonth();
            detectedMonth = this.MONTHS[currentMonthIdx];
        }

        // 4. Match service columns using synonyms + word matching
        const columns = window.TAX_COLUMNS || [
            "Luz", "Gas", "O.Sanitaria", "ARBA", "ARBA COMPLEMEN.", "Cable", "Municipalidad",
            "Celular Seba y Matteo", "Celular Mecha + Tel.fijo", "Seguro PEUGEOT", "Seguro ETIOS",
            "Patente PEUGEOT", "Patente ETIOS", "Visa PROVINCIA", "Visa GALICIA (mecha)",
            "Visa GALICIA (seba)", "CAJA SEGURIDA GALICIA", "Alarma", "Seguro Hogar",
            "Seguro celular Matteo", "ICA", "MONOTRIBUTO AFIP / VEP", "OSDE",
            "DISNEY PLUS (COMPARTIDO)", "CLUB BIGUA", "TRAINING GYM MATTEO"
        ];

        let detectedTaxes = [];
        let highestScore = 0;

        columns.forEach(col => {
            const normCol = col.toLowerCase();
            let score = 0;

            // A. Coincidencia por sinónimos
            for (const [syn, taxName] of Object.entries(this.SYNONYMS)) {
                if (text.includes(syn) && normCol.includes(taxName.toLowerCase())) {
                    score += 10;
                }
            }

            // B. Coincidencia por palabras individuales
            const words = normCol.replace(/[()./]/g, ' ').split(/\s+/).filter(w => w.length > 2);
            words.forEach(w => {
                if (text.includes(w)) {
                    score += 5;
                }
            });

            // C. Modificadores específicos para afinar
            if (text.includes('luz') && normCol.includes('luz')) score += 5;
            if (text.includes('gas') && normCol.includes('gas')) score += 5;
            if (text.includes('arba') && normCol.includes('arba')) score += 5;
            if (text.includes('peugeot') && normCol.includes('peugeot')) score += 5;
            if (text.includes('etios') && normCol.includes('etios')) score += 5;
            if (text.includes('expensas') && normCol.includes('expensas')) score += 5;
            if (text.includes('mgp') && normCol.includes('mgp')) score += 5;
            if (text.includes('cochera') && normCol.includes('cochera')) score += 5;

            if (score > highestScore) {
                highestScore = score;
                detectedTaxes = [col];
            } else if (score === highestScore && score > 0) {
                detectedTaxes.push(col);
            }
        });

        // Filtrar candidatos si hay palabras más específicas en el query (ej. "seguro" o "patente")
        if (detectedTaxes.length > 1) {
            const specificWords = ["seguro", "patente", "celular", "visa", "arba", "expensas", "mgp", "luz", "gas", "agua", "cochera"];
            for (const word of specificWords) {
                if (text.includes(word)) {
                    const filtered = detectedTaxes.filter(c => c.toLowerCase().includes(word));
                    if (filtered.length > 0) {
                        detectedTaxes = filtered;
                        break;
                    }
                }
            }
        }

        if (detectedTaxes.length > 0) {
            detectedTax = detectedTaxes[0]; // Conservar compatibilidad hacia atrás
        }

        return {
            detectedMonth,
            detectedTax,
            detectedTaxes,
            detectedAmount,
            detectedProperty
        };
    }
};
window.SmartNLPParser = SmartNLPParser;

class BotAsistente {
    constructor() {
        this.MONTHS = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];
        this.context = null; // Contexto conversacional activo
        window.botInstance = this; // Registrar instancia global

        this.getRowValue = (row, colName) => {
            if (!row || !colName) return undefined;
            if (row[colName] !== undefined) return row[colName];
            
            const norm = colName.trim().toLowerCase();
            for (const key of Object.keys(row)) {
                const keyNorm = key.trim().toLowerCase();
                if (keyNorm === norm) {
                    return row[key];
                }
                if (keyNorm.includes(norm) || norm.includes(keyNorm)) {
                    const lenDiff = Math.abs(keyNorm.length - norm.length);
                    if (lenDiff <= 3) {
                        return row[key];
                    }
                }
            }
            return undefined;
        };

        this.initUI();
    }

    get taxColumns() {
        return window.TAX_COLUMNS || [
            "Luz", "Gas", "O.Sanitaria", "ARBA", "ARBA COMPLEMEN.", "Cable", "Municipalidad",
            "Celular Seba y Matteo", "Celular Mecha + Tel.fijo", "Seguro PEUGEOT", "Seguro ETIOS",
            "Patente PEUGEOT", "Patente ETIOS", "Visa PROVINCIA", "Visa GALICIA (mecha)",
            "Visa GALICIA (seba)", "CAJA SEGURIDA GALICIA", "Alarma", "Seguro Hogar",
            "Seguro celular Matteo", "ICA", "MONOTRIBUTO AFIP / VEP", "OSDE",
            "DISNEY PLUS (COMPARTIDO)", "CLUB BIGUA", "TRAINING GYM MATTEO"
        ];
    }

    initUI() {
        // Crear estilos para el widget flotante del bot
        const style = document.createElement('style');
        style.textContent = `
            /* ===== WIDGET FLOTANTE ===== */
            .bot-widget {
                position: fixed;
                bottom: 25px;
                right: 25px;
                z-index: 9998;
                font-family: -apple-system, 'Segoe UI', sans-serif;
            }

            .bot-bubble-trigger {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #25D366 0%, #128C7E 100%);
                color: white;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.6rem;
                cursor: pointer;
                box-shadow: 0 6px 20px rgba(37, 211, 102, 0.45);
                transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                border: none;
            }

            .bot-bubble-trigger:hover {
                transform: scale(1.1);
                box-shadow: 0 10px 28px rgba(37, 211, 102, 0.55);
            }

            /* ===== VENTANA DEL CHAT ===== */
            .bot-window {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 370px;
                height: 560px;
                border-radius: 12px;
                box-shadow: 0 12px 40px rgba(0,0,0,0.25);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                transform: translateY(20px) scale(0.95);
                pointer-events: none;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                background: #ECE5DD;
            }

            .bot-window.show {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: all;
            }

            @media (max-width: 768px) {
                header, .container {
                    display: none !important;
                }
                .bot-widget {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    height: 100dvh !important;
                    bottom: 0 !important;
                    right: 0 !important;
                    margin: 0 !important;
                    padding: 0 !important;
                    z-index: 9999 !important;
                }
                .bot-bubble-trigger {
                    display: none !important;
                }
                .bot-window {
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    height: 100dvh !important;
                    bottom: 0 !important;
                    right: 0 !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    opacity: 1 !important;
                    transform: none !important;
                    pointer-events: all !important;
                    display: flex !important;
                }
                .bot-close {
                    display: none !important;
                }
            }

            /* ===== HEADER ESTILO WHATSAPP ===== */
            .bot-header {
                background: #075E54;
                color: white;
                padding: 10px 16px;
                display: flex;
                align-items: center;
                gap: 10px;
                min-height: 60px;
            }

            .bot-avatar {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: #25D366;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.1rem;
                flex-shrink: 0;
            }

            .bot-info h4 {
                font-size: 1rem;
                font-weight: 600;
                margin: 0;
                line-height: 1.2;
            }

            .bot-info span {
                font-size: 0.72rem;
                color: rgba(255,255,255,0.75);
                display: flex;
                align-items: center;
                gap: 4px;
                margin-top: 1px;
            }

            .bot-close {
                margin-left: auto;
                background: none;
                border: none;
                color: rgba(255,255,255,0.8);
                font-size: 1.1rem;
                cursor: pointer;
                transition: color 0.2s;
                padding: 4px 6px;
            }
            .bot-close:hover { color: white; }

            /* ===== ÁREA DE MENSAJES (wallpaper) ===== */
            .bot-messages {
                flex: 1;
                padding: 10px 12px 25px 12px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 3px;
                background-color: #ECE5DD;
                background-image:
                    radial-gradient(circle at 1px 1px, rgba(0,0,0,0.04) 1px, transparent 0);
                background-size: 20px 20px;
                scrollbar-width: thin;
                scrollbar-color: #bbb transparent;
            }
            .bot-messages::-webkit-scrollbar { width: 4px; }
            .bot-messages::-webkit-scrollbar-thumb { background: #bbb; border-radius: 4px; }

            /* ===== FILA del mensaje (alinear burbuja + cola juntas) ===== */
            .wa-msg-row {
                display: flex;
                align-items: flex-end;
                max-width: 85%;
                margin-bottom: 4px;
            }
            .wa-msg-row.row-bot  { align-self: flex-start; }
            .wa-msg-row.row-user { align-self: flex-end;   flex-direction: row-reverse; }

            /* ===== COLA (tail) del mensaje ===== */
            .wa-tail {
                width: 8px;
                height: 13px;
                flex-shrink: 0;
                margin-bottom: 1px;
            }
            .wa-tail-bot {
                margin-right: -1px;
            }
            .wa-tail-user {
                margin-left: -1px;
            }

            /* ===== BURBUJA ===== */
            .msg-bubble {
                padding: 7px 10px 4px 10px;
                border-radius: 8px;
                font-size: 0.84rem;
                line-height: 1.45;
                word-wrap: break-word;
                word-break: break-word;
                position: relative;
                max-width: 100%;
            }

            .msg-bot {
                background: #ffffff;
                color: #111;
                border-top-left-radius: 0;
                box-shadow: 0 1px 1px rgba(0,0,0,0.15);
            }

            .msg-user {
                background: #DCF8C6;
                color: #111;
                border-top-right-radius: 0;
                box-shadow: 0 1px 1px rgba(0,0,0,0.15);
            }

            /* ===== META (hora + ticks) dentro de cada burbuja ===== */
            .wa-meta {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 3px;
                margin-top: 3px;
                line-height: 1;
            }

            .wa-time {
                font-size: 0.67rem;
                color: rgba(0,0,0,0.45);
                white-space: nowrap;
            }

            .wa-ticks {
                font-size: 0.75rem;
                color: #34B7F1;   /* azul doble tilde */
                letter-spacing: -2px;
                line-height: 1;
            }
            /* Para mensajes del bot ocultamos los ticks */
            .msg-bot .wa-ticks { display: none; }
            /* hora del bot ligeramente más oscura */
            .msg-bot .wa-time { color: rgba(0,0,0,0.4); }

            /* ===== TYPING INDICATOR ===== */
            .wa-typing {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 6px 4px 2px 4px;
                min-width: 45px;
                justify-content: center;
            }
            .wa-typing span {
                width: 7px;
                height: 7px;
                background: rgba(0,0,0,0.4);
                border-radius: 50%;
                display: inline-block;
                animation: wa-bounce 1.3s infinite ease-in-out;
            }
            .wa-typing span:nth-child(2) { animation-delay: 0.2s; }
            .wa-typing span:nth-child(3) { animation-delay: 0.4s; }

            @keyframes wa-bounce {
                0%, 60%, 100% { transform: translateY(0); }
                30% { transform: translateY(-5px); }
            }

            /* ===== BOTÓN ACCIÓN EN CHAT ===== */
            .btn-chat-action {
                background: #25D366;
                color: white;
                border: none;
                padding: 7px 13px;
                border-radius: 20px;
                font-size: 0.78rem;
                font-weight: 600;
                cursor: pointer;
                margin-top: 8px;
                display: inline-flex;
                align-items: center;
                gap: 6px;
                transition: all 0.2s ease;
                box-shadow: 0 2px 6px rgba(37,211,102,0.3);
            }
            .btn-chat-action:hover {
                background: #128C7E;
                transform: translateY(-1px);
            }
            .btn-chat-action:disabled {
                background: #9ca3af;
                cursor: not-allowed;
                box-shadow: none;
            }

            /* ===== INPUT AREA ===== */
            .bot-input-area {
                padding: 6px 8px;
                background: #f0f0f0;
                border-top: 1px solid #ddd;
                display: flex;
                gap: 8px;
                align-items: center;
                width: 100%;
                box-sizing: border-box;
            }

            .wa-input-container {
                flex: 1;
                background: #ffffff;
                border-radius: 22px;
                display: flex;
                align-items: center;
                padding: 0 16px;
                box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                min-width: 0;
                height: 38px;
            }

            .wa-input-container input {
                flex: 1;
                border: none;
                outline: none;
                font-size: 16px; /* Evita que Safari en iOS haga zoom automático al enfocar */
                background: transparent;
                padding: 8px 0;
                color: #111;
                min-width: 0;
            }

            .bot-send-btn {
                width: 38px;
                height: 38px;
                border-radius: 50%;
                border: none;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                transition: all 0.2s;
                flex-shrink: 0;
            }

            .bot-send-btn.wa-mic-state {
                background: transparent;
                color: #54656f;
                box-shadow: none;
                font-size: 1.25rem;
            }

            .bot-send-btn.wa-send-state {
                background: #00a884;
                color: white;
                box-shadow: 0 1px 3px rgba(0,0,0,0.15);
                font-size: 1rem;
            }

            .bot-send-btn:hover {
                transform: scale(1.05);
            }
        `;
        document.head.appendChild(style);

        // Crear la estructura HTML del widget
        const widget = document.createElement('div');
        widget.className = 'bot-widget';
        widget.innerHTML = `
            <div class="bot-bubble-trigger" id="botTrigger" onclick="window.botInstance.toggleWindow()">
                <i class="fa-brands fa-whatsapp"></i>
            </div>
            <div class="bot-window" id="botWindow">
                <div class="bot-header">
                    <div class="bot-avatar">
                        <i class="fa-solid fa-robot" style="color:#fff;"></i>
                    </div>
                    <div class="bot-info">
                        <h4>Asistente Virtual</h4>
                        <span>En línea</span>
                    </div>
                    <button class="bot-close" onclick="window.botInstance.toggleWindow()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="bot-messages" id="botMessages"></div>
                <div class="bot-input-area">
                    <div class="wa-input-container">
                        <input type="text" id="botInput" placeholder="Escribe un mensaje..." onkeypress="window.botInstance.handleKeyPress(event)" oninput="window.botInstance.handleInput(event)">
                    </div>
                    <button class="bot-send-btn wa-mic-state" id="botSendBtn" onclick="window.botInstance.submitUserMessage()">
                        <i class="fa-solid fa-microphone" id="botSendIcon"></i>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(widget);

        // Guardar referencia global
        window.botInstance = this;

        // Mensaje de bienvenida con estilo WhatsApp
        setTimeout(() => {
            this.appendMessage(
                `¡Buenas! 👋 Soy tu asistente personal de impuestos.<br>` +
                `Contame, ¿en qué te puedo dar una mano hoy? Podés preguntarme cosas como:<br><br>` +
                `💡 <i>"¿Qué tengo pendiente este mes?"</i><br>` +
                `💡 <i>"¿Cuánto gasté en Luz en el año?"</i><br>` +
                `💡 <i>"¿Cuál fue mi mayor gasto?"</i>`,
                'bot'
            );
        }, 100);
    }

    toggleWindow() {
        const win = document.getElementById('botWindow');
        win.classList.toggle('show');
        if (win.classList.contains('show')) {
            document.getElementById('botInput').focus();
            this.scrollToBottom();
        }
    }

    sendPreset(text) {
        document.getElementById('botInput').value = text;
        this.submitUserMessage();
    }

    handleKeyPress(event) {
        if (event.key === 'Enter') {
            this.submitUserMessage();
        }
    }

    handleInput(event) {
        const text = event.target.value;
        const sendBtn = document.getElementById('botSendBtn');
        const sendIcon = document.getElementById('botSendIcon');

        if (text && text.trim().length > 0) {
            if (sendBtn) {
                sendBtn.classList.remove('wa-mic-state');
                sendBtn.classList.add('wa-send-state');
            }
            if (sendIcon) {
                sendIcon.className = 'fa-solid fa-paper-plane';
            }
        } else {
            if (sendBtn) {
                sendBtn.classList.remove('wa-send-state');
                sendBtn.classList.add('wa-mic-state');
            }
            if (sendIcon) {
                sendIcon.className = 'fa-solid fa-microphone';
            }
        }
    }

    scrollToBottom() {
        const msgs = document.getElementById('botMessages');
        if (msgs) {
            setTimeout(() => {
                msgs.scrollTop = msgs.scrollHeight;
            }, 60);
        }
    }

    showTypingIndicator() {
        const msgs = document.getElementById('botMessages');
        
        const row = document.createElement('div');
        row.className = `wa-msg-row row-bot wa-typing-row`;

        const tailBotSVG = `<svg class="wa-tail wa-tail-bot" viewBox="0 0 8 13" xmlns="http://www.w3.org/2000/svg"><path d="M1 0 Q0 8 5 13 L8 13 L8 0 Z" fill="#ffffff"/></svg>`;
        
        const makeTail = (svgStr) => {
            const tmp = document.createElement('div');
            tmp.innerHTML = svgStr;
            return tmp.firstElementChild;
        };

        const bubble = document.createElement('div');
        bubble.className = `msg-bubble msg-bot`;
        bubble.innerHTML = `<div class="wa-typing"><span></span><span></span><span></span></div>`;

        row.appendChild(makeTail(tailBotSVG));
        row.appendChild(bubble);
        msgs.appendChild(row);
        
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        const typingRows = document.querySelectorAll('.wa-typing-row');
        typingRows.forEach(row => row.remove());
    }

    submitUserMessage() {
        const input = document.getElementById('botInput');
        const text = input.value.trim();
        if (!text) {
            if (window.showToast) {
                window.showToast('Nota de voz', 'La grabación de voz no está habilitada.', 'error');
            }
            return;
        }

        // Renderizar mensaje del usuario
        this.appendMessage(text, 'user');
        input.value = '';

        // Resetear el estado del botón a micrófono
        const sendBtn = document.getElementById('botSendBtn');
        const sendIcon = document.getElementById('botSendIcon');
        if (sendBtn) {
            sendBtn.classList.remove('wa-send-state');
            sendBtn.classList.add('wa-mic-state');
        }
        if (sendIcon) {
            sendIcon.className = 'fa-solid fa-microphone';
        }

        // Mostrar indicador de pensando (tres puntos saltarines)
        this.showTypingIndicator();

        // Procesar y responder después de 2 segundos (2000 ms)
        setTimeout(() => {
            this.hideTypingIndicator();
            const reply = this.processNLPQuery(text);
            this.appendMessage(reply, 'bot');
        }, 2000);
    }

    appendMessage(text, sender) {
        const msgs = document.getElementById('botMessages');

        // Hora actual
        const now = new Date();
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        const timeStr = `${hh}:${mm}`;

        // Ticks dobles (solo para mensajes del usuario, en azul)
        const ticks = sender === 'user' ? `<span class="wa-ticks">✓✓</span>` : '';

        // Crear cola (tail) como nodo DOM para evitar destruir el bubble
        const makeTail = (svgStr) => {
            const tmp = document.createElement('div');
            tmp.innerHTML = svgStr;
            return tmp.firstElementChild;
        };
        const tailBotSVG = `<svg class="wa-tail wa-tail-bot" viewBox="0 0 8 13" xmlns="http://www.w3.org/2000/svg"><path d="M1 0 Q0 8 5 13 L8 13 L8 0 Z" fill="#ffffff"/></svg>`;
        const tailUserSVG = `<svg class="wa-tail wa-tail-user" viewBox="0 0 8 13" xmlns="http://www.w3.org/2000/svg"><path d="M7 0 Q8 8 3 13 L0 13 L0 0 Z" fill="#DCF8C6"/></svg>`;

        const row = document.createElement('div');
        row.className = `wa-msg-row row-${sender}`;

        const bubble = document.createElement('div');
        bubble.className = `msg-bubble msg-${sender}`;
        bubble.innerHTML = `${text}<div class="wa-meta"><span class="wa-time">${timeStr}</span>${ticks}</div>`;

        if (sender === 'bot') {
            row.appendChild(makeTail(tailBotSVG));
            row.appendChild(bubble);
        } else {
            row.appendChild(bubble);
            row.appendChild(makeTail(tailUserSVG));
        }

        msgs.appendChild(row);
        this.scrollToBottom();
    }

    // ====================================================
    // ANALIZADOR CONVERSACIONAL INTELIGENTE (NLP)
    // ====================================================
    processNLPQuery(query) {
        // Normalizar texto (quitar acentos y puntuación para búsquedas robustas)
        const cleanText = (str) => {
            return str.normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .toLowerCase()
                      .replace(/[¿?¡!.,]/g, "")
                      .trim();
        };
        const q = cleanText(query);
        
        // Obtener la base de datos real desde index.html
        const data = window.database || [];
        if (data.length === 0) {
            return "¡Upa! Parece que la base de datos de impuestos está vacía o no cargó todavía. Fijate si está todo bien conectado. 🔌";
        }

        // --- DETECTAR SALUDOS Y CONVERSACIÓN COLOQUIAL ---
        const greetings = ["hola", "buenas", "buen dia", "buenos dias", "buenas tardes", "buenas noches", "como andas", "como va", "que tal", "hello", "hi", "todo bien"];
        const thanks = ["gracias", "muchas gracias", "buenisimo", "joya", "genial", "espectacular", "de diez", "barbaro", "excelente", "ok", "listo"];
        const goodbyes = ["chau", "adios", "nos vemos", "hasta luego", "hasta pronto"];

        if (greetings.some(g => q === g || q.startsWith(g + " "))) {
            const currentMonthName = this.getCurrentMonthName();
            return `¡Buenas! ¿Cómo andás? 😊 Acá estoy para darte una mano con la planilla de gastos.<br><br>` +
                   `Contame, ¿qué querés chusmear hoy? Podés preguntarme cosas como:<br>` +
                   `• <i>"¿Qué debo pagar en ${currentMonthName}?"</i><br>` +
                   `• <i>"¿Cuánto gasté en Luz este año?"</i><br>` +
                   `• <i>"¿Cuál es el mayor gasto?"</i>`;
        }

        if (thanks.some(t => q === t || q.startsWith(t + " "))) {
            return `¡De nada! Buenísimo que te sirva. Chiflame si necesitás otra cosa. 😉`;
        }

        if (goodbyes.some(g => q === g || q.startsWith(g + " "))) {
            return `¡Dale, nos vemos! Que andes de diez. ¡Un abrazo! 👋`;
        }

        // --- VERIFICAR CONTEXTO CONVERSACIONAL ACTIVO (CONTINUAR DIÁLOGO) ---
        if (this.context && this.context.pendingAction) {
            if (this.context.pendingAction === "awaiting_amount") {
                // El bot estaba esperando un monto (ej. el usuario tipeó solo "10000")
                const numbers = q.match(/\b\d+(\.\d{1,2})?\b/g);
                if (numbers) {
                    const amount = parseFloat(numbers[0]);
                    if (!isNaN(amount) && amount > 0) {
                        const { taxName, month } = this.context;
                        if (window.updateTaxCell) {
                            window.updateTaxCell(month, taxName, amount);
                        }
                        this.context = null; // Limpiar contexto
                        return `¡Buenísimo! Registrado de una en la planilla: 📝<br><br>` +
                            `• Servicio: <strong>${taxName}</strong><br>` +
                            `• Mes: <strong>${month}</strong><br>` +
                            `• Monto: <strong>$${amount.toLocaleString('es-AR')}</strong><br><br>` +
                            `Ya se guardó en Google Sheets y podés ver cómo se actualiza el tablero.`;
                    }
                } else {
                    // Si no escribió un número pero introdujo otra orden o consulta, cancelamos el contexto
                    this.context = null;
                }
            } else if (this.context.pendingAction === "awaiting_confirmation") {
                // El bot estaba esperando confirmación de sí/no
                const affirmative = ["si", "sii", "si por favor", "dale", "ok", "confirmar", "confirmado", "bueno", "yes"];
                const negative = ["no", "cancelar", "espera", "descartar", "nono"];

                if (affirmative.some(word => q.includes(word))) {
                    const { taxName, month, amount } = this.context;
                    if (window.updateTaxCell) {
                        window.updateTaxCell(month, taxName, amount);
                    }
                    this.context = null; // Limpiar contexto
                    return `¡Joya! Quedó confirmado y registrado: ⚡<br><br>` +
                        `• Servicio: <strong>${taxName}</strong><br>` +
                        `• Mes: <strong>${month}</strong><br>` +
                        `• Monto: <strong>$${amount.toLocaleString('es-AR')}</strong><br><br>` +
                        `Ya se subió a Google Sheets y se actualizó en tu pantalla.`;
                } else if (negative.some(word => q.includes(word))) {
                    const { taxName, month } = this.context;
                    this.context = null; // Limpiar contexto
                    return `De una, cancelé el registro para <strong>${taxName}</strong> de <strong>${month}</strong>. No modifiqué nada de la planilla. 👍`;
                } else {
                    // Si no escribió afirmación ni negación pero introdujo otra orden, cancelamos contexto
                    this.context = null;
                }
            }
        }

        // 1. Usar el SmartNLPParser unificado para resolver mes, tributo y propiedad
        const parsed = window.SmartNLPParser.parse(query);
        const matchedMonth = parsed.detectedMonth;
        const matchedTax = parsed.detectedTax;
        const matchedProperty = parsed.detectedProperty;

        // 2. Comando Cargar/Pagar directo (solo si detectó algún servicio/tributo coincidente)
        const hasDirectCommandKeyword = q.includes('cargar') || q.includes('pagar') || q.includes('registra') || q.includes('subir');
        const hasDetectedTax = matchedTax || (parsed.detectedTaxes && parsed.detectedTaxes.length > 0);
        if (hasDirectCommandKeyword && hasDetectedTax) {
            return this.handleQuickLoadNLP(query); // Pasamos query original para no perder cifras decimales
        }

        // --- EXTRACCIÓN DE TODOS LOS MESES MENCIONADOS (Para comparativas) ---
        const foundMonths = [];
        this.MONTHS.forEach(m => {
            const mClean = cleanText(m);
            if (q.includes(mClean) || q.includes(mClean.substring(0, 3))) {
                if (!foundMonths.includes(m)) foundMonths.push(m);
            }
        });

        // ====================================================
        // CATEGORÍA 1: COMPARACIÓN ENTRE MESES
        // ====================================================
        if (foundMonths.length >= 2 && (q.includes('mas') || q.includes('diferencia') || q.includes('compara') || q.includes('vs'))) {
            const m1 = foundMonths[0];
            const m2 = foundMonths[1];

            const row1 = data.find(r => r.Mes.trim().toLowerCase() === m1.toLowerCase());
            const row2 = data.find(r => r.Mes.trim().toLowerCase() === m2.toLowerCase());

            let total1 = 0;
            let total2 = 0;

            if (row1) {
                this.taxColumns.forEach(c => {
                    const val = parseFloat(row1[c]);
                    if (!isNaN(val) && val > 0) total1 += val;
                });
            }
            if (row2) {
                this.taxColumns.forEach(c => {
                    const val = parseFloat(row2[c]);
                    if (!isNaN(val) && val > 0) total2 += val;
                });
            }

            const diff = Math.abs(total1 - total2);
            let comparativaText = `⚖️ **¡Chequeado! Comparación de gastos:**<br><br>` +
                `• Total **${m1}**: **$${total1.toLocaleString('es-AR', { minimumFractionDigits: 0 })}**<br>` +
                `• Total **${m2}**: **$${total2.toLocaleString('es-AR', { minimumFractionDigits: 0 })}**<br><br>`;

            if (total1 === total2) {
                comparativaText += `¡Qué loco! En ambos meses gastaste exactamente la misma cantidad.`;
            } else {
                const mayorMes = total1 > total2 ? m1 : m2;
                const menorMes = total1 > total2 ? m2 : m1;
                comparativaText += `📈 Gastaste **$${diff.toLocaleString('es-AR', { minimumFractionDigits: 0 })} más** en **${mayorMes}** que en **${menorMes}**.`;
            }
            return comparativaText;
        }

        // ====================================================
        // CATEGORÍA 2: PENDIENTES / DEBO
        // ====================================================
        if (q.includes('pendiente') || q.includes('debo') || q.includes('falta') || q.includes('deber') || q.includes('sin pagar') || q.includes('deuda') || (q.includes('pagar') && !matchedTax) || (q.includes('pago') && !matchedTax)) {
            const targetMonth = matchedMonth || this.getCurrentMonthName();
            const row = data.find(r => r.Mes.trim().toLowerCase() === targetMonth.trim().toLowerCase());
            
            if (!row) {
                return `Uf, no tengo cargados los datos para el mes de **${targetMonth}** en mi base.`;
            }

            // Filtrar columnas por la propiedad activa (o la especificada)
            let activeTab = window.activePropertyTab || 'roca';
            if (matchedProperty) {
                activeTab = matchedProperty.toLowerCase();
            }
            const activeGroups = window.PROPERTY_COLUMN_GROUPS || {};
            const activeCols = activeGroups[activeTab] || this.taxColumns;

            const pendingList = [];
            activeCols.forEach(col => {
                const val = this.getRowValue(row, col);
                if (val === undefined || val === null || val === "" || val === "-") {
                    pendingList.push(col);
                } else {
                    const numericVal = parseFloat(val);
                    if (isNaN(numericVal) || numericVal === 0) {
                        pendingList.push(col);
                    }
                }
            });

            if (pendingList.length === 0) {
                return `🎉 ¡Qué golazo! Tenés todos los impuestos de **${targetMonth}** pagados para **${activeTab.toUpperCase()}**. ¡Todo al día!`;
            }

            return `📋 **Acá tenés lo pendiente de ${targetMonth} en ${activeTab.toUpperCase()} (${pendingList.length} en total):**<br><ul style="padding-left: 20px; margin-top: 6px;">` + 
                pendingList.map(item => `<li style="margin-bottom:4px;">${item}</li>`).join('') + `</ul>`;
        }

        // ====================================================
        // CATEGORÍA 3: DETALLE DE PAGOS DE UN MES ("qué pagué en...")
        // ====================================================
        if ((q.includes('pague') || q.includes('pagos') || q.includes('detalle') || q.includes('movimiento') || q.includes('resumen') || q.includes('lista')) && matchedMonth && !matchedTax) {
            const row = data.find(r => r.Mes.trim().toLowerCase() === matchedMonth.trim().toLowerCase());
            if (!row) return `Che, no tengo anotado ningún pago para **${matchedMonth}** todavía.`;

            // Filtrar columnas por la propiedad activa (o la especificada)
            let activeTab = window.activePropertyTab || 'roca';
            if (matchedProperty) {
                activeTab = matchedProperty.toLowerCase();
            }
            const activeGroups = window.PROPERTY_COLUMN_GROUPS || {};
            const activeCols = activeGroups[activeTab] || this.taxColumns;

            const paidList = [];
            let monthTotal = 0;
            activeCols.forEach(col => {
                const val = this.getRowValue(row, col);
                if (val !== undefined && val !== null && val !== "" && val !== "-") {
                    const numeric = parseFloat(val);
                    if (!isNaN(numeric) && numeric > 0) {
                        paidList.push({ name: col, amount: numeric });
                        monthTotal += numeric;
                    }
                }
            });

            if (paidList.length === 0) {
                return `📅 Para **${matchedMonth}** en **${activeTab.toUpperCase()}** no figura ningún pago registrado todavía.`;
            }

            return `📅 **Esto es lo que pagaste de ${activeTab.toUpperCase()} en ${matchedMonth}:**<br><br>` +
                paidList.map(p => `• ${p.name}: <strong>$${p.amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong>`).join('<br>') +
                `<br><br>💰 **Total gastado en ${matchedMonth}:** <strong>$${monthTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</strong> (${paidList.length} pagos registrados).`;
        }

        // ====================================================
        // CATEGORÍA 4: PROMEDIO MENSUAL / MEDIAS
        // ====================================================
        if (q.includes('promedio') || q.includes('media') || q.includes('mensual promedio')) {
            if (matchedTax) {
                let sum = 0;
                let count = 0;
                data.forEach(row => {
                    const val = parseFloat(this.getRowValue(row, matchedTax));
                    if (!isNaN(val) && val > 0) {
                        sum += val;
                        count++;
                    }
                });

                if (count === 0) {
                    return `No registré pagos para **${matchedTax}** en todo el año para poder calcular un promedio.`;
                }

                const avg = sum / count;
                return `📊 De promedio para **${matchedTax}** venís pagando **$${avg.toLocaleString('es-AR', { maximumFractionDigits: 0 })}** al mes (estimado sobre ${count} meses pagados).`;
            }

            // Promedio general de todos los meses con datos
            let totalGeneral = 0;
            let monthsWithData = 0;
            data.forEach(row => {
                let monthSum = 0;
                this.taxColumns.forEach(c => {
                    const val = parseFloat(this.getRowValue(row, c));
                    if (!isNaN(val) && val > 0) monthSum += val;
                });
                if (monthSum > 0) {
                    totalGeneral += monthSum;
                    monthsWithData++;
                }
            });

            if (monthsWithData === 0) return "No tengo suficientes pagos cargados como para sacar promedios.";
            const generalAvg = totalGeneral / monthsWithData;
            return `📊 Tu gasto promedio general es de **$${generalAvg.toLocaleString('es-AR', { maximumFractionDigits: 0 })} por mes** (calculado sobre ${monthsWithData} meses activos).`;
        }

        // ====================================================
        // CATEGORÍA 5: MAYOR O MENOR GASTO
        // ====================================================
        if (q.includes('mayor') || q.includes('maximo') || q.includes('mas caro') || q.includes('caro') || q.includes('menor') || q.includes('minimo') || q.includes('mas barato') || q.includes('barato') || q.includes('bajo')) {
            const isLowest = q.includes('menor') || q.includes('minimo') || q.includes('barato') || q.includes('bajo');
            let targetVal = isLowest ? Infinity : 0;
            let targetTax = "";
            let targetMonth = "";

            // Filtrar columnas por la propiedad activa (o la especificada)
            let activeTab = window.activePropertyTab || 'roca';
            if (matchedProperty) {
                activeTab = matchedProperty.toLowerCase();
            }
            const activeGroups = window.PROPERTY_COLUMN_GROUPS || {};
            const activeCols = activeGroups[activeTab] || this.taxColumns;

            const scanRow = (row, mName) => {
                activeCols.forEach(col => {
                    const val = parseFloat(this.getRowValue(row, col)) || 0;
                    if (val > 0) {
                        if (isLowest) {
                            if (val < targetVal) {
                                targetVal = val;
                                targetTax = col;
                                targetMonth = mName;
                            }
                        } else {
                            if (val > targetVal) {
                                targetVal = val;
                                targetTax = col;
                                targetMonth = mName;
                            }
                        }
                    }
                });
            };

            if (matchedMonth) {
                const row = data.find(r => r.Mes.trim().toLowerCase() === matchedMonth.trim().toLowerCase());
                if (row) scanRow(row, matchedMonth);
            } else {
                data.forEach(row => scanRow(row, row.Mes));
            }

            if (targetVal === Infinity || targetVal === 0) {
                return "No encontré pagos registrados para analizar.";
            }

            return `${isLowest ? '📉 El menor gasto registrado' : '🔥 El mayor gasto registrado'} ${matchedMonth ? `en ${matchedMonth}` : 'en lo que va del año'} es **${targetTax}** con un monto de **$${targetVal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}** en el mes de **${targetMonth}**.`;
        }

        // ====================================================
        // CATEGORÍA 6: SUMATORIAS / TOTALES
        // ====================================================
        if (q.includes('total') || q.includes('gasto') || q.includes('cuanto') || q.includes('suma') || q.includes('acumulado')) {
            // Caso B1: Suma de un impuesto particular en todo el año
            if (matchedTax) {
                let sum = 0;
                let monthsPaid = [];
                data.forEach(row => {
                    const val = this.getRowValue(row, matchedTax);
                    if (val !== undefined && val !== null && val !== "" && val !== "-") {
                        const numericVal = parseFloat(val);
                        if (!isNaN(numericVal) && numericVal > 0) {
                            sum += numericVal;
                            monthsPaid.push(`${row.Mes}: $${numericVal.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`);
                        }
                    }
                });

                if (sum === 0) {
                    return `No registré ningún pago para **${matchedTax}** en todo el año.`;
                }

                return `💰 De **${matchedTax}** llevás pagado un total de **$${sum.toLocaleString('es-AR', { maximumFractionDigits: 0 })}** en el año.<br><br>Detalle de meses:<br>` + 
                    monthsPaid.map(m => `• ${m}`).join('<br>');
            }

            // Filtrar columnas por la propiedad activa (o la especificada)
            let activeTab = window.activePropertyTab || 'roca';
            if (matchedProperty) {
                activeTab = matchedProperty.toLowerCase();
            }
            const activeGroups = window.PROPERTY_COLUMN_GROUPS || {};
            const activeCols = activeGroups[activeTab] || this.taxColumns;

            // Caso B2: Suma de todo un mes particular
            if (matchedMonth) {
                const row = data.find(r => r.Mes.trim().toLowerCase() === matchedMonth.trim().toLowerCase());
                if (!row) return `No tengo registros de gastos cargados para **${matchedMonth}**.`;

                let monthTotal = 0;
                let itemsCount = 0;
                activeCols.forEach(col => {
                    const val = this.getRowValue(row, col);
                    if (val !== undefined && val !== null && val !== "" && val !== "-") {
                        const numeric = parseFloat(val);
                        if (!isNaN(numeric) && numeric > 0) {
                            monthTotal += numeric;
                            itemsCount++;
                        }
                    }
                });

                return `📅 En **${matchedMonth}** se te fueron **$${monthTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}** en total para **${activeTab.toUpperCase()}**, distribuidos en ${itemsCount} servicios pagados.`;
            }

            // Caso B3: Suma total anual general
            let grandTotal = 0;
            data.forEach(row => {
                activeCols.forEach(col => {
                    const val = this.getRowValue(row, col);
                    if (val !== undefined && val !== null && val !== "" && val !== "-") {
                        const numeric = parseFloat(val);
                        if (!isNaN(numeric) && numeric > 0) grandTotal += numeric;
                    }
                });
            });

            return `📈 Tu acumulado general de gastos en lo que va del año para **${activeTab.toUpperCase()}** es de **$${grandTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}** sumando todos los impuestos de esa propiedad.`;
        }

        // ====================================================
        // CATEGORÍA 7: ESTADO / CONSULTA DE UN SERVICIO (Edea Roca, OSDE, Gas, etc.)
        // ====================================================
        if (matchedTax) {
            // Escribieron el nombre de un impuesto o preguntaron por él (ej. "luz", "edea", "info edea")
            const currentMonthName = this.getCurrentMonthName();
            const currentMonthRow = data.find(r => r.Mes.trim().toLowerCase() === currentMonthName.toLowerCase());
            
            let statusCurrent = "🔴 PENDIENTE (Todavía no figura pago)";
            if (currentMonthRow) {
                const val = parseFloat(this.getRowValue(currentMonthRow, matchedTax));
                if (!isNaN(val) && val > 0) {
                    statusCurrent = `🟢 PAGADO (se pagaron **$${val.toLocaleString('es-AR', { minimumFractionDigits: 0 })}**)`;
                }
            }

            // Buscar historial y total anual
            let annualTotal = 0;
            let paymentsCount = 0;
            let lastAmount = null;
            let lastMonth = "";

            data.forEach(row => {
                const val = parseFloat(this.getRowValue(row, matchedTax));
                if (!isNaN(val) && val > 0) {
                    annualTotal += val;
                    paymentsCount++;
                    lastAmount = val;
                    lastMonth = row.Mes;
                }
            });

            let responseText = `ℹ️ **Estado de: ${matchedTax}**${matchedProperty ? ` (en ${matchedProperty})` : ''}<br><br>`;
            responseText += `• 📅 **Mes actual (${currentMonthName}):** ${statusCurrent}<br>`;
            
            if (paymentsCount > 0) {
                responseText += `• 🕒 **Último pago:** $${lastAmount.toLocaleString('es-AR', { minimumFractionDigits: 0 })} en **${lastMonth}**<br>`;
                responseText += `• 📈 **Total anual pagado:** **$${annualTotal.toLocaleString('es-AR', { minimumFractionDigits: 0 })}** (${paymentsCount} meses pagados)<br>`;
            } else {
                responseText += `• 🕒 **Historial:** No registré ningún pago para este servicio en lo que va del año.<br>`;
            }
            
            return responseText;
        }

        // ====================================================
        // CATEGORÍA 8: RESPUESTA DEFAULT INTELIGENTE
        // ====================================================
        return `Che, no llegué a captar del todo qué quisiste hacer o consultar. 😅
            <br><br>
            Probá preguntándome algo así:<br>
            • <i>"¿Qué tengo pendiente en ${matchedMonth || 'Mayo'}?"</i><br>
            • <i>"¿Qué pagué en Mayo?"</i><br>
            • <i>"¿Cuánto gasté en Luz este año?"</i><br>
            • <i>"¿Gasté más en Mayo o en Abril?"</i><br>
            • <i>"¿Cuál fue el mayor gasto de Enero?"</i>`;
    }

    getCurrentMonthName() {
        return this.MONTHS[new Date().getMonth()];
    }

    // Procesar la carga rápida del bot
    handleQuickLoadNLP(q) {
        const parsed = window.SmartNLPParser.parse(q);
        const { detectedMonth, detectedTax, detectedTaxes, detectedAmount, detectedProperty } = parsed;
        const finalMonth = detectedMonth || this.getCurrentMonthName();
        const data = window.database || [];

        // 1. Si hay múltiples coincidencias (ej. "peugeot" sin especificar seguro o patente)
        if (detectedTaxes && detectedTaxes.length > 1) {
            let reply = `📋 **Mapeando planilla...** Detecté que quieres registrar un pago en **${finalMonth}** pero coincide con más de un servicio en tu planilla. ¿Cuál de ellos deseas registrar?<br><br>`;
            
            detectedTaxes.forEach(tax => {
                let currentValue = null;
                const targetRow = data.find(r => r.Mes && r.Mes.trim().toLowerCase() === finalMonth.toLowerCase());
                const val = this.getRowValue(targetRow, tax);
                if (targetRow && val !== undefined && val !== null && val !== "" && val !== "-") {
                    const parsedVal = parseFloat(val);
                    if (!isNaN(parsedVal) && parsedVal > 0) {
                        currentValue = parsedVal;
                    }
                }
                
                const lastPaid = this.getLastPaidAmount(tax);
                
                reply += `<strong>• ${tax}:</strong> `;
                if (currentValue !== null) {
                    reply += `🟢 Ya está PAGADO ($${currentValue.toLocaleString('es-AR')})<br><br>`;
                } else if (lastPaid !== null) {
                    reply += `🔴 PENDIENTE<br>` +
                        `<button class="btn-chat-action" onclick="window.botInstance.confirmPayment('${finalMonth}', '${tax}', ${lastPaid}, this)">` +
                        `<i class="fa-solid fa-floppy-disk"></i> Registrar $${lastPaid.toLocaleString('es-AR')}</button><br><br>`;
                } else {
                    reply += `🔴 PENDIENTE (Sin historial)<br>` +
                        `*Escribe ej. "pagar ${tax} 50000" para registrar.*<br><br>`;
                }
            });
            return reply;
        }

        // 2. Coincidencia única con monto especificado
        if (detectedTax && detectedAmount) {
            // Enviar petición de guardado DIRECTAMENTE (sin tocar el DOM de la página principal)
            if (window.updateTaxCell) {
                window.updateTaxCell(finalMonth, detectedTax, detectedAmount);
                let reply = `⚡ ¡Excelente! He detectado y enviado el registro:<br><br>` + 
                    `• Servicio: <strong>${detectedTax}</strong><br>`;
                if (detectedProperty) {
                    reply += `• Propiedad: <strong>${detectedProperty}</strong><br>`;
                }
                reply += `• Mes: <strong>${finalMonth}</strong><br>` + 
                    `• Monto: <strong>$${detectedAmount.toLocaleString('es-AR')}</strong><br><br>` + 
                    `Guardado en Google Sheets y actualizado en el tablero.`;
                return reply;
            }
        } else if (detectedTax) {
            // 3. Coincidencia única sin monto especificado (Proactivo)
            
            // Verificar si ya está pagado en este mes
            let currentValue = null;
            const targetRow = data.find(r => r.Mes && r.Mes.trim().toLowerCase() === finalMonth.toLowerCase());
            const val = this.getRowValue(targetRow, detectedTax);
            if (targetRow && val !== undefined && val !== null && val !== "" && val !== "-") {
                const parsedVal = parseFloat(val);
                if (!isNaN(parsedVal) && parsedVal > 0) {
                    currentValue = parsedVal;
                }
            }

            // Buscar último monto pagado en el historial de todo el año
            const lastPaid = this.getLastPaidAmount(detectedTax);

            if (currentValue !== null) {
                // Ya pagado en este mes
                let reply = `⚠️ **${detectedTax}** ${detectedProperty ? `(en ${detectedProperty})` : ''} **ya está PAGADO** en **${finalMonth}**.<br><br>` +
                    `• Monto registrado actual: <strong>$${currentValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong><br><br>` +
                    `¿Deseas sobreescribir este pago con otro monto? Solo escríbelo en el chat, por ejemplo: <i>"cargar ${detectedTax} 95000"</i>.`;
                return reply;
            }

            if (lastPaid !== null) {
                // Pendiente, pero tenemos historial (Guardar contexto de confirmación)
                this.context = {
                    pendingAction: "awaiting_confirmation",
                    taxName: detectedTax,
                    month: finalMonth,
                    property: detectedProperty,
                    amount: lastPaid
                };

                let reply = `📋 **Mapeando planilla...** Detecté que **${detectedTax}** ${detectedProperty ? `(en ${detectedProperty})` : ''} está **PENDIENTE** en **${finalMonth}**.<br><br>` +
                    `• Último monto pagado en tu historial: <strong>$${lastPaid.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>.<br><br>` +
                    `¿Quieres registrar este mismo valor en la celda de **${finalMonth}**?<br><br>` +
                    `<button class="btn-chat-action" onclick="window.botInstance.confirmPayment('${finalMonth}', '${detectedTax}', ${lastPaid}, this)">` +
                    `<i class="fa-solid fa-floppy-disk"></i> Sí, guardar $${lastPaid.toLocaleString('es-AR')}</button><br><br>` +
                    `*Si prefieres registrar otro monto, escríbelo aquí (ej. "pagar ${detectedTax} 75000").*`;
                return reply;
            } else {
                // Pendiente y sin historial anterior (Guardar contexto de monto pendiente)
                this.context = {
                    pendingAction: "awaiting_amount",
                    taxName: detectedTax,
                    month: finalMonth,
                    property: detectedProperty
                };

                let reply = `📋 **Mapeando planilla...** Detecté que **${detectedTax}** ${detectedProperty ? `(en ${detectedProperty})` : ''} está **PENDIENTE** en **${finalMonth}**.<br><br>` +
                    `No encontré registros de pagos anteriores para este servicio en tu historial.<br><br>` +
                    `Por favor, indícame qué monto deseas registrar escribiendo en el chat, por ejemplo: <i>"pagar ${detectedTax} 85000"</i>.`;
                return reply;
            }
        }

        return `⚠️ Para registrar un pago por chat, escribe algo como:<br><i>"cargar luz 75000 en mayo"</i> u <i>"OSDE 120000 marzo"</i>. Asegúrate de incluir el nombre del servicio y el monto.`;
    }

    // Acción directa e interactiva del botón sin tocar el DOM de la página principal
    confirmPayment(mes, columna, monto, btnElement) {
        if (btnElement) {
            btnElement.disabled = true;
            btnElement.innerHTML = `<i class="fa-solid fa-circle-check"></i> ¡Registrado!`;
        }
        
        if (window.updateTaxCell) {
            window.updateTaxCell(mes, columna, monto);
        }
    }

    getLastPaidAmount(taxName) {
        const data = window.database || [];
        if (data.length === 0) return null;
        
        const monthOrder = [
            "Diciembre", "Noviembre", "Octubre", "Septiembre", "Agosto", "Julio",
            "Junio", "Mayo", "Abril", "Marzo", "Febrero", "Enero"
        ];
        
        for (const m of monthOrder) {
            const row = data.find(r => r.Mes && r.Mes.trim().toLowerCase() === m.toLowerCase());
            const valStr = this.getRowValue(row, taxName);
            if (row && valStr !== undefined && valStr !== null && valStr !== "" && valStr !== "-") {
                const val = parseFloat(valStr);
                if (!isNaN(val) && val > 0) {
                    return val;
                }
            }
        }
        return null;
    }
}

// Auto-inicializar cuando el script se cargue
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new BotAsistente());
} else {
    new BotAsistente();
}
