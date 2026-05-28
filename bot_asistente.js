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
        const text = rawText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        let detectedMonth = null;
        let detectedTax = null;
        let detectedAmount = null;
        let detectedProperty = null;
        let detectedPropertyKey = null;

        // 1. Detect property (Roca, Casa, etc.)
        for (const prop of this.PROPERTIES) {
            if (text.includes(prop.key)) {
                detectedProperty = prop.label;
                detectedPropertyKey = prop.key;
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
            const regexM = new RegExp('\\b' + m.toLowerCase() + '\\b');
            const regexM3 = new RegExp('\\b' + m.substring(0, 3).toLowerCase() + '\\b');
            if (regexM.test(text) || regexM3.test(text)) {
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
                const regex = new RegExp('\\b' + syn + '\\b');
                if (regex.test(text) && normCol.includes(taxName.toLowerCase())) {
                    score += 10;
                }
            }

            // B. Coincidencia por palabras individuales
            const words = normCol.replace(/[()./]/g, ' ').split(/\s+/).filter(w => w.length > 2);
            words.forEach(w => {
                // Si la palabra coincide con el nombre de la propiedad detectada, no la sumamos al score de tax para evitar falsos positivos
                if (detectedProperty && (w === detectedProperty.toLowerCase() || detectedProperty.toLowerCase().includes(w))) {
                    return;
                }
                const regexW = new RegExp('\\b' + w + '\\b');
                if (regexW.test(text)) {
                    score += 5;
                }
            });

            // C. Modificadores específicos para afinar
            if (/\bluz\b/.test(text) && normCol.includes('luz')) score += 5;
            if (/\bgas\b/.test(text) && normCol.includes('gas')) score += 5;
            if (/\barba\b/.test(text) && normCol.includes('arba')) score += 5;
            if (/\bpeugeot\b/.test(text) && normCol.includes('peugeot')) score += 5;
            if (/\betios\b/.test(text) && normCol.includes('etios')) score += 5;
            if (/\bexpensas\b/.test(text) && normCol.includes('expensas')) score += 5;
            if (/\bmgp\b/.test(text) && normCol.includes('mgp')) score += 5;
            if (/\bcochera\b/.test(text) && normCol.includes('cochera')) score += 5;

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

        // Filtrar por propiedad si se detectó una y hay múltiples candidatos de tax
        if (detectedTaxes.length > 1 && detectedPropertyKey) {
            const groups = window.PROPERTY_COLUMN_GROUPS || {};
            const allowedCols = groups[detectedPropertyKey] || [];
            if (allowedCols.length > 0) {
                const propFiltered = detectedTaxes.filter(c => allowedCols.includes(c));
                if (propFiltered.length > 0) {
                    detectedTaxes = propFiltered;
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

        // Inicializar reconocimiento de voz
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = null;
        this.isRecording = false;
        if (SpeechRecognition) {
            try {
                this.recognition = new SpeechRecognition();
                this.recognition.lang = 'es-AR';
                this.recognition.continuous = false;
                this.recognition.interimResults = true;

                this.recognition.onstart = () => {
                    this.isRecording = true;
                    const micBtn = document.getElementById('botMicBtn');
                    const input = document.getElementById('botInput');
                    if (micBtn) micBtn.classList.add('recording');
                    if (input) {
                        input.placeholder = "Escuchando... hablá ahora 🎙️";
                        input.focus();
                    }
                };

                this.recognition.onresult = (event) => {
                    let interimTranscript = '';
                    let finalTranscript = '';
                    for (let i = event.resultIndex; i < event.results.length; ++i) {
                        if (event.results[i].isFinal) {
                            finalTranscript += event.results[i][0].transcript;
                        } else {
                            interimTranscript += event.results[i][0].transcript;
                        }
                    }
                    const input = document.getElementById('botInput');
                    if (input) {
                        if (finalTranscript) {
                            input.value = finalTranscript;
                        } else if (interimTranscript) {
                            input.value = interimTranscript;
                        }
                    }
                };

                this.recognition.onerror = (event) => {
                    console.error("Speech recognition error:", event.error);
                    this.isRecording = false;
                    const micBtn = document.getElementById('botMicBtn');
                    if (micBtn) micBtn.classList.remove('recording');
                    
                    const input = document.getElementById('botInput');
                    if (input) input.placeholder = "Escribe un mensaje...";

                    if (event.error === 'not-allowed') {
                        this.appendMessage(
                            `⚠️ **Permiso denegado:** No tengo acceso al micrófono. Habilitalo en la configuración del navegador para poder dictar.`,
                            'bot'
                        );
                    } else if (event.error !== 'no-speech') {
                        this.appendMessage(
                            `⚠️ **Error de dictado:** Ocurrió un inconveniente con el reconocimiento de voz (${event.error}). Intentá de nuevo.`,
                            'bot'
                        );
                    }
                };

                this.recognition.onend = () => {
                    this.isRecording = false;
                    const micBtn = document.getElementById('botMicBtn');
                    if (micBtn) micBtn.classList.remove('recording');
                    const input = document.getElementById('botInput');
                    if (input && input.placeholder.includes("Escuchando")) {
                        input.placeholder = "Escribe un mensaje...";
                    }
                };
            } catch (err) {
                console.error("SpeechRecognition initialization failed:", err);
                this.recognition = null;
            }
        }

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

            /* Quick action buttons near the bubble (mobile) */
            .bot-quick-actions {
                display: none;
                position: fixed;
                right: 25px;
                bottom: 95px;
                z-index: 9999;
                flex-direction: column;
                gap: 8px;
                align-items: center;
            }
            .bot-quick-actions button {
                width: 44px;
                height: 44px;
                border-radius: 10px;
                border: none;
                background: #075E54;
                color: white;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 6px 18px rgba(0,0,0,0.15);
                cursor: pointer;
            }
            @media (max-width: 768px) {
                .bot-quick-actions { display: flex; }
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
                body.bot-active header, body.bot-active .container {
                    display: none !important;
                }
                body.bot-active .bot-widget {
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
                body:not(.bot-active) .bot-widget {
                    position: fixed;
                    bottom: 25px;
                    right: 25px;
                    z-index: 9998;
                    width: auto;
                    height: auto;
                }
                body.bot-active .bot-bubble-trigger {
                    display: none !important;
                }
                body:not(.bot-active) .bot-bubble-trigger {
                    display: flex !important;
                }
                .bot-window {
                    display: none;
                }
                .bot-window.show {
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
                    display: block !important;
                }
                .mobile-header-actions {
                    display: flex !important;
                    margin-right: 15px;
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

            .mobile-header-actions {
                display: none;
                margin-left: auto;
                gap: 18px;
                align-items: center;
            }
            .mobile-header-actions button {
                background: none;
                border: none;
                color: rgba(255,255,255,0.85);
                font-size: 1.2rem;
                padding: 0;
                cursor: pointer;
            }
            .mobile-header-actions button:hover {
                color: white;
            }
            .mobile-header-actions button:disabled {
                color: rgba(255,255,255,0.4);
                cursor: not-allowed;
            }

            /* Ensure header actions are visible when chat is opened on any small screen */
            @media (max-width: 768px) {
                .bot-window.show .mobile-header-actions {
                    display: flex !important;
                }
            }

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
                align-items: flex-start;
                max-width: 85%;
                margin-bottom: 4px;
            }
            .wa-msg-row.row-bot  { align-self: flex-start; }
            .wa-msg-row.row-user { align-self: flex-end; }

            /* ===== COLA (tail) del mensaje ===== */
            .wa-tail {
                width: 8px;
                height: 13px;
                flex-shrink: 0;
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

            .bot-mic-btn {
                background: none;
                border: none;
                color: #8696a0;
                font-size: 1.1rem;
                cursor: pointer;
                padding: 4px;
                margin-left: 4px;
                display: none;
                align-items: center;
                justify-content: center;
                transition: color 0.2s, transform 0.2s;
                flex-shrink: 0;
            }

            .bot-mic-btn:hover {
                color: #54656f;
                transform: scale(1.1);
            }

            .bot-attachment-btn {
                background: none;
                border: none;
                color: #8696a0;
                font-size: 1.1rem;
                cursor: pointer;
                padding: 4px;
                margin-left: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: color 0.2s, transform 0.2s;
                flex-shrink: 0;
            }

            .bot-attachment-btn:hover {
                color: #54656f;
                transform: scale(1.1);
            }

            .bot-mic-btn.recording {
                color: #ea4335;
                animation: bot-mic-pulse 1.5s infinite ease-in-out;
            }

            @keyframes bot-mic-pulse {
                0% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.2); opacity: 0.7; }
                100% { transform: scale(1); opacity: 1; }
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

        // Detección estricta de dispositivo móvil
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

        widget.innerHTML = `
            <div class="bot-bubble-group">
                <div class="bot-bubble-trigger" id="botTrigger" onclick="window.botInstance.toggleWindow()">
                    <i class="fa-brands fa-whatsapp"></i>
                </div>
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
                    <div class="mobile-header-actions">
                        <button type="button" title="Abrir Alquileres" onclick="event.stopPropagation(); if(window.location.pathname.includes('alquiler.html')) { window.botInstance.closeAndClearChat(); } else { window.location.href='alquiler.html'; }"><i class="fa-solid fa-house-user"></i></button>
                        <button type="button" title="Abrir Limpieza" onclick="event.stopPropagation(); if(window.location.pathname.includes('limpieza.html')) { window.botInstance.closeAndClearChat(); } else { window.location.href='limpieza.html'; }"><i class="fa-solid fa-broom"></i></button>
                    </div>
                    <button class="bot-close" onclick="window.botInstance.closeAndClearChat()"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="bot-messages" id="botMessages"></div>
                <div class="bot-input-area">
                    <div class="wa-input-container">
                        <input type="text" id="botInput" placeholder="Escribe un mensaje..." onkeypress="window.botInstance.handleKeyPress(event)">
                        <button class="bot-attachment-btn" id="botAttachmentBtn" onclick="window.botInstance.triggerImageUpload(event)" title="Subir o tomar foto de factura">
                            <i class="fa-solid fa-camera"></i>
                        </button>
                        <button class="bot-mic-btn" id="botMicBtn" onclick="window.botInstance.toggleDictation(event)" title="Dictar por voz">
                            <i class="fa-solid fa-microphone"></i>
                        </button>
                    </div>
                    <button class="bot-send-btn" id="botSendBtn" onclick="window.botInstance.submitUserMessage()">
                        <i class="fa-solid fa-paper-plane" id="botSendIcon"></i>
                    </button>
                </div>
            </div>
            <input type="file" id="botImageInput" accept="image/*" style="display: none;" onchange="window.botInstance.handleImageUpload(event)">
        `;
        document.body.appendChild(widget);

        // Guardar referencia global
        window.botInstance = this;

        // Mensaje de bienvenida con estilo WhatsApp
        setTimeout(() => {
            this.sendWelcomeMessage();
        }, 100);

        if (isMobile) {
            document.body.classList.add('bot-active');
            setTimeout(() => {
                const win = document.getElementById('botWindow');
                if (win) win.classList.add('show');
            }, 150);
        }

        // Mostrar botón de micrófono si el reconocimiento de voz está disponible
        if (this.recognition) {
            const micBtn = document.getElementById('botMicBtn');
            if (micBtn) micBtn.style.display = 'flex';
        }
    }

    sendWelcomeMessage() {
        const msgs = document.getElementById('botMessages');
        if (msgs) msgs.innerHTML = '';

        this.appendMessage(
            `¡Buenas! 👋 Soy tu asistente personal de impuestos.<br>` +
            `Contame, ¿en qué te puedo dar una mano hoy? Podés preguntarme cosas como:<br><br>` +
            `💡 <i>"¿Qué tengo pendiente este mes?"</i><br>` +
            `💡 <i>"¿Cuánto gasté en Luz en el año?"</i><br>` +
            `💡 <i>"¿Cuál fue mi mayor gasto?"</i>`,
            'bot'
        );
    }

    toggleWindow() {
        const win = document.getElementById('botWindow');
        win.classList.toggle('show');
        if (win.classList.contains('show')) {
            document.body.classList.add('bot-active');
            document.getElementById('botInput').focus();
            this.scrollToBottom();
        } else {
            document.body.classList.remove('bot-active');
        }
    }

    closeAndClearChat() {
        // 1. Cerrar la ventana del bot
        const win = document.getElementById('botWindow');
        if (win) {
            win.classList.remove('show');
        }
        document.body.classList.remove('bot-active');

        // 2. Limpiar el input
        const input = document.getElementById('botInput');
        if (input) {
            input.value = '';
        }

        // 3. Limpiar el contexto conversacional
        this.context = null;

        // 4. Reiniciar los mensajes al estado inicial de bienvenida
        this.sendWelcomeMessage();
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

    toggleDictation(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (!this.recognition) return;

        if (this.isRecording) {
            this.recognition.stop();
        } else {
            try {
                this.recognition.start();
            } catch (err) {
                console.error("Error starting SpeechRecognition:", err);
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

        const tailBotSVG = `<svg class="wa-tail wa-tail-bot" viewBox="0 0 8 13" xmlns="http://www.w3.org/2000/svg"><path d="M1.533 2.568L8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z" fill="#ffffff"/></svg>`;

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
            this.appendMessage('Debe escribirme un mensaje de texto.', 'bot');
            return;
        }

        // Renderizar mensaje del usuario
        this.appendMessage(text, 'user');
        input.value = '';


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
        const tailBotSVG = `<svg class="wa-tail wa-tail-bot" viewBox="0 0 8 13" xmlns="http://www.w3.org/2000/svg"><path d="M1.533 2.568L8 11.193V0H2.812C1.042 0 .474 1.156 1.533 2.568z" fill="#ffffff"/></svg>`;
        const tailUserSVG = `<svg class="wa-tail wa-tail-user" viewBox="0 0 8 13" xmlns="http://www.w3.org/2000/svg"><path d="M5.188 0H0v11.193l6.467-8.625C7.526 1.156 6.958 0 5.188 0z" fill="#DCF8C6"/></svg>`;

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
            return `¡Buenas! ¿Cómo andás? 😊 Acá estoy para darte una mano con el sistema de gastos.<br><br>` +
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
                        return `¡Buenísimo! Registrado de una en el sistema: 📝<br><br>` +
                            `• Servicio: <strong>${taxName}</strong><br>` +
                            `• Mes: <strong>${month}</strong><br>` +
                            `• Monto: <strong>$${amount.toLocaleString('es-AR')}</strong><br><br>` +
                            `Ya se guardó en el sistema y podés ver cómo se actualiza el tablero.`;
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
                        `Ya se subió al sistema y se actualizó en tu pantalla.`;
                } else if (negative.some(word => q.includes(word))) {
                    const { taxName, month } = this.context;
                    this.context = null; // Limpiar contexto
                    return `De una, cancelé el registro para <strong>${taxName}</strong> de <strong>${month}</strong>. No modifiqué nada del sistema. 👍`;
                } else {
                    // Si no escribió afirmación ni negación pero introdujo otra orden, cancelamos contexto
                    this.context = null;
                }
            } else if (this.context.pendingAction === "reviewing_pending") {
                // Flujo de revisión uno por uno de items pendientes del mes
                const affirmativeR = ["si", "sii", "dale", "ok", "confirmar", "yes", "bueno", "claro", "obvio"];
                const negativeR = ["no", "saltar", "omitir", "skip", "paso"];
                const confirmAllR = ["todos", "todo", "confirmar todos", "todos si", "registrar todo"];

                const { month: mR, pendingItems: pItems, currentIndex: cIdx } = this.context;

                if (confirmAllR.some(w => q.includes(w))) {
                    // Registrar todos los restantes de una
                    const remaining = pItems.slice(cIdx);
                    remaining.forEach(item => {
                        if (window.updateTaxCell) window.updateTaxCell(mR, item.tax, item.amount);
                    });
                    this.context = null;
                    const cnt = remaining.length;
                    return `✅ ¡Joya! Registré los <strong>${cnt}</strong> pago${cnt !== 1 ? 's' : ''} pendiente${cnt !== 1 ? 's' : ''} de <strong>${mR}</strong> como pagos confirmados. Ya se actualizó el tablero. 🎉`;
                }

                if (affirmativeR.some(w => q.includes(w))) {
                    const item = pItems[cIdx];
                    if (window.updateTaxCell) window.updateTaxCell(mR, item.tax, item.amount);
                    const nextIdx = cIdx + 1;
                    if (nextIdx >= pItems.length) {
                        this.context = null;
                        return `✅ ¡Registrado! <strong>${item.tax}</strong> $${item.amount.toLocaleString('es-AR')} en ${mR}.<br><br>¡Revisaste todos los pendientes! No queda nada más. 🎉`;
                    }
                    this.context.currentIndex = nextIdx;
                    const next = pItems[nextIdx];
                    const remCnt = pItems.length - nextIdx;
                    return `✅ ¡Registrado! <strong>${item.tax}</strong> $${item.amount.toLocaleString('es-AR')} confirmado.<br><br>` +
                        `Quedan <strong>${remCnt}</strong> más. ¿Registrás este?<br>` +
                        `• <strong>${next.tax}</strong>: $${next.amount.toLocaleString('es-AR')}<br><br>` +
                        `Respondé <strong>si</strong>, <strong>no</strong> para saltarlo, o <strong>todos</strong> para confirmar el resto de una.`;
                }

                if (negativeR.some(w => q.includes(w))) {
                    const item = pItems[cIdx];
                    const nextIdx = cIdx + 1;
                    if (nextIdx >= pItems.length) {
                        this.context = null;
                        return `Ok, salté <strong>${item.tax}</strong>. Ya revisaste todos los pendientes de <strong>${mR}</strong>. 👍`;
                    }
                    this.context.currentIndex = nextIdx;
                    const next = pItems[nextIdx];
                    const remCnt2 = pItems.length - nextIdx;
                    return `Ok, salté <strong>${item.tax}</strong>.<br><br>` +
                        `Quedan <strong>${remCnt2}</strong> más. ¿Registrás este?<br>` +
                        `• <strong>${next.tax}</strong>: $${next.amount.toLocaleString('es-AR')}<br><br>` +
                        `Respondé <strong>si</strong>, <strong>no</strong>, o <strong>todos</strong> para el resto.`;
                }

                // No reconoció la respuesta
                const cur = pItems[cIdx];
                return `No entendí. ¿Registrás <strong>${cur.tax}</strong> ($${cur.amount.toLocaleString('es-AR')}) de <strong>${mR}</strong> como pago? Respondé <strong>si</strong>, <strong>no</strong>, o <strong>todos</strong>.`;
            }
        }

        // 1. Usar el SmartNLPParser unificado para resolver mes, tributo y propiedad
        const parsed = window.SmartNLPParser.parse(query);
        let matchedMonth = parsed.detectedMonth;
        let matchedTax = parsed.detectedTax;
        let matchedProperty = parsed.detectedProperty;

        // Memoria contextual: si el usuario menciona una propiedad pero no el impuesto, 
        // usamos el último impuesto sobre el que veníamos hablando.
        if (!matchedTax && this.lastTopic && this.lastTopic.tax) {
            // Re-evaluar considerando la propiedad actual
            if (matchedProperty) {
                const baseTax = this.lastTopic.tax.split(' ')[0]; // Ej. "Luz" de "Luz Gascon"
                // Buscar si existe el impuesto para esa propiedad
                const newTaxCandidate = `${baseTax} ${matchedProperty}`;
                if (window.TAX_COLUMNS && window.TAX_COLUMNS.includes(newTaxCandidate)) {
                    matchedTax = newTaxCandidate;
                } else if (window.TAX_COLUMNS && window.TAX_COLUMNS.includes(baseTax) && matchedProperty.toLowerCase() === 'roca') {
                    matchedTax = baseTax; // Roca usa el nombre base
                } else {
                    matchedTax = this.lastTopic.tax;
                }
            } else {
                matchedTax = this.lastTopic.tax;
            }
            parsed.detectedTax = matchedTax;
            if (!matchedMonth && this.lastTopic.month) {
                matchedMonth = this.lastTopic.month;
                parsed.detectedMonth = matchedMonth;
            }
        }

        // Guardar contexto para la próxima pregunta
        if (matchedTax) {
            this.lastTopic = { tax: matchedTax, month: matchedMonth };
        }

        // 1.5. Consulta de PENDIENTES AGENDADOS en un mes (ej: "tengo agendado en junio")
        const hasPendingReviewKw = q.includes('agendado') || q.includes('agendados');
        if (hasPendingReviewKw && matchedMonth) {
            return this.handlePendingReview(matchedMonth, matchedProperty);
        }

        // 2. Comando Borrar / Eliminar
        const hasDeleteKeyword = q.includes('borrar') || q.includes('elimina') || q.includes('quitar') || q.includes('deshacer');
        const hasDetectedTax = matchedTax || (parsed.detectedTaxes && parsed.detectedTaxes.length > 0);
        if (hasDeleteKeyword && hasDetectedTax) {
            return this.handleDeleteNLP(parsed, q);
        }

        // 3. Comando Cargar/Pagar directo
        const hasDirectCommandKeyword = q.includes('cargar') || q.includes('pagar') || q.includes('registra') || q.includes('subir') || q.includes('anota') || q.includes('guarda') || q.includes('agrega') || q.includes('agenda') || (parsed.detectedAmount && (q.includes('pendiente') || q.includes('deuda') || q.includes('debo')));
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
        if (!matchedTax && (q.includes('pendiente') || q.includes('debo') || q.includes('falta') || q.includes('deber') || q.includes('sin pagar') || q.includes('deuda') || q.includes('pagar') || q.includes('pago'))) {
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
                    const strVal = String(val).trim().toLowerCase();
                    const numericVal = parseFloat(val);
                    if (strVal.startsWith('p ')) {
                        const pAmount = parseFloat(strVal.replace('p ', '').trim());
                        if (!isNaN(pAmount)) {
                            pendingList.push(`${col} (Pendiente: $${pAmount.toLocaleString('es-AR')})`);
                        } else {
                            pendingList.push(col);
                        }
                    } else if (isNaN(numericVal) || numericVal === 0) {
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
                const rawVal = this.getRowValue(currentMonthRow, matchedTax);
                const strVal = String(rawVal || "").trim().toLowerCase();
                const val = parseFloat(rawVal);

                if (strVal.startsWith('p ')) {
                    const pAmount = parseFloat(strVal.replace('p ', '').trim());
                    if (!isNaN(pAmount)) {
                        statusCurrent = `🔴 PENDIENTE (Monto asignado a pagar: $${pAmount.toLocaleString('es-AR')})`;
                    }
                } else if (!isNaN(val) && val > 0) {
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

    // Procesar borrar pago
    handleDeleteNLP(parsed, q) {
        const { detectedMonth, detectedTax } = parsed;
        let finalMonth = detectedMonth;

        if (!detectedTax) return "No entendí bien qué impuesto o servicio querés borrar. Decime algo como 'borrar luz de mayo'.";

        // Si pide borrar "el último", ignoramos el mes detectado por defecto y buscamos cuál fue
        const textLower = (q || "").toLowerCase();
        const isUltimo = textLower.includes('ultimo') || textLower.includes('último') || textLower.includes('ese');

        if (isUltimo) {
            const data = window.database || [];
            let lastPaidMonth = "";
            data.forEach(row => {
                const val = parseFloat(this.getRowValue(row, detectedTax));
                if (!isNaN(val) && val > 0) {
                    lastPaidMonth = row.Mes;
                }
            });
            if (lastPaidMonth) {
                finalMonth = lastPaidMonth;
            } else {
                return `No encontré ningún pago registrado de **${detectedTax}** para borrar.`;
            }
        }

        if (!finalMonth) {
            finalMonth = this.getCurrentMonthName();
        }

        if (window.updateTaxCell) {
            window.updateTaxCell(finalMonth, detectedTax, 0);
            return `🗑️ ¡Listo! He borrado el pago de **${detectedTax}** del mes de **${finalMonth}**.<br><br>Ya se actualizó en el sistema.`;
        }
        return "Hubo un error al intentar borrar el pago.";
    }

    // Procesar la carga rápida del bot
    handleQuickLoadNLP(q) {
        const parsed = window.SmartNLPParser.parse(q);
        const { detectedMonth, detectedTax, detectedTaxes, detectedAmount, detectedProperty } = parsed;
        const finalMonth = detectedMonth || this.getCurrentMonthName();
        const data = window.database || [];

        // 1. Si hay múltiples coincidencias (ej. "peugeot" sin especificar seguro o patente)
        if (detectedTaxes && detectedTaxes.length > 1) {
            let reply = `📋 **Mapeando sistema...** Detecté que quieres registrar un pago en **${finalMonth}** pero coincide con más de un servicio en tu sistema. ¿Cuál de ellos deseas registrar?<br><br>`;

            detectedTaxes.forEach(tax => {
                let currentValue = null;
                let pendingValue = null;
                const targetRow = data.find(r => r.Mes && r.Mes.trim().toLowerCase() === finalMonth.toLowerCase());
                const val = this.getRowValue(targetRow, tax);
                if (targetRow && val !== undefined && val !== null && val !== "" && val !== "-") {
                    const strVal = String(val).trim().toLowerCase();
                    const parsedVal = parseFloat(val);
                    if (strVal.startsWith('p ')) {
                        const pAmount = parseFloat(strVal.replace('p ', '').trim());
                        if (!isNaN(pAmount)) pendingValue = pAmount;
                    } else if (!isNaN(parsedVal) && parsedVal > 0) {
                        currentValue = parsedVal;
                    }
                }

                const lastPaid = this.getLastPaidAmount(tax);

                reply += `<strong>• ${tax}:</strong> `;
                if (currentValue !== null) {
                    reply += `🟢 Ya está PAGADO ($${currentValue.toLocaleString('es-AR')})<br><br>`;
                } else if (detectedAmount) {
                    const isPending = q.toLowerCase().includes('pendiente') || q.toLowerCase().includes('deuda') || q.toLowerCase().includes('debo');
                    const finalAmountToSave = isPending ? `p ${detectedAmount}` : detectedAmount;
                    const labelBtn = isPending ? `Asignar PENDIENTE $${detectedAmount.toLocaleString('es-AR')}` : `Pagar $${detectedAmount.toLocaleString('es-AR')}`;

                    reply += `🔴 Detectado en tu mensaje<br>` +
                        `<button class="btn-chat-action" onclick="window.botInstance.confirmPayment('${finalMonth}', '${tax}', '${finalAmountToSave}', this)">` +
                        `<i class="fa-solid fa-floppy-disk"></i> ${labelBtn}</button><br><br>`;
                } else if (pendingValue !== null) {
                    reply += `🔴 PENDIENTE (Monto asignado: $${pendingValue.toLocaleString('es-AR')})<br>` +
                        `<button class="btn-chat-action" onclick="window.botInstance.confirmPayment('${finalMonth}', '${tax}', ${pendingValue}, this)">` +
                        `<i class="fa-solid fa-floppy-disk"></i> Pagar $${pendingValue.toLocaleString('es-AR')}</button><br><br>`;
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
                const isPending = q.toLowerCase().includes('pendiente') || q.toLowerCase().includes('deuda') || q.toLowerCase().includes('debo');
                const finalAmountToSave = isPending ? `p ${detectedAmount}` : detectedAmount;

                window.updateTaxCell(finalMonth, detectedTax, finalAmountToSave);

                let reply;
                if (isPending) {
                    reply = `🕐 ¡Listo! Agendé el pago como <strong>PENDIENTE</strong>:<br><br>` +
                        `• Servicio: <strong>${detectedTax}</strong><br>`;
                    if (detectedProperty) reply += `• Propiedad: <strong>${detectedProperty}</strong><br>`;
                    reply += `• Mes: <strong>${finalMonth}</strong><br>` +
                        `• Monto pendiente: <strong>$${detectedAmount.toLocaleString('es-AR')}</strong><br><br>` +
                        `📌 Quedó registrado como deuda/pendiente en el tablero. Cuando lo pagues, decime <em>"registrar ${detectedTax} ${finalMonth}"</em> y lo confirmo. 👍`;
                } else {
                    reply = `⚡ ¡Excelente! Registré el pago:<br><br>` +
                        `• Servicio: <strong>${detectedTax}</strong><br>`;
                    if (detectedProperty) reply += `• Propiedad: <strong>${detectedProperty}</strong><br>`;
                    reply += `• Mes: <strong>${finalMonth}</strong><br>` +
                        `• Monto pagado: <strong>$${detectedAmount.toLocaleString('es-AR')}</strong><br><br>` +
                        `Guardado en el sistema y actualizado en el tablero. ✅`;
                }
                return reply;
            }
        } else if (detectedTax) {

            // 3. Coincidencia única sin monto especificado (Proactivo)

            // Verificar si ya está pagado en este mes
            let currentValue = null;
            let pendingValue = null;
            const targetRow = data.find(r => r.Mes && r.Mes.trim().toLowerCase() === finalMonth.toLowerCase());
            const val = this.getRowValue(targetRow, detectedTax);
            if (targetRow && val !== undefined && val !== null && val !== "" && val !== "-") {
                const strVal = String(val).trim().toLowerCase();
                const parsedVal = parseFloat(val);
                if (strVal.startsWith('p ')) {
                    const pAmount = parseFloat(strVal.replace('p ', '').trim());
                    if (!isNaN(pAmount)) pendingValue = pAmount;
                } else if (!isNaN(parsedVal) && parsedVal > 0) {
                    currentValue = parsedVal;
                }
            }

            if (currentValue !== null) {
                // Ya pagado en este mes
                let reply = `⚠️ **${detectedTax}** ${detectedProperty ? `(en ${detectedProperty})` : ''} **ya está PAGADO** en **${finalMonth}**.<br><br>` +
                    `• Monto registrado actual: <strong>$${currentValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong><br><br>` +
                    `¿Deseas sobreescribir este pago con otro monto? Solo escríbelo en el chat, por ejemplo: <i>"cargar ${detectedTax} 95000"</i>.`;
                return reply;
            }

            if (pendingValue !== null) {
                // Hay un valor pendiente explícito
                this.context = {
                    pendingAction: "awaiting_confirmation",
                    taxName: detectedTax,
                    month: finalMonth,
                    property: detectedProperty,
                    amount: pendingValue
                };

                let reply = `📋 **Mapeando sistema...** Detecté que **${detectedTax}** ${detectedProperty ? `(en ${detectedProperty})` : ''} está **PENDIENTE** en **${finalMonth}**.<br><br>` +
                    `• Monto pendiente asignado: <strong>$${pendingValue.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>.<br><br>` +
                    `¿Quieres registrar este valor como pagado en la celda de **${finalMonth}**?<br><br>` +
                    `<button class="btn-chat-action" onclick="window.botInstance.confirmPayment('${finalMonth}', '${detectedTax}', ${pendingValue}, this)">` +
                    `<i class="fa-solid fa-floppy-disk"></i> Sí, pagar $${pendingValue.toLocaleString('es-AR')}</button><br><br>` +
                    `*Si prefieres registrar otro monto, escríbelo aquí (ej. "pagar ${detectedTax} 75000").*`;
                return reply;
            }

            // Buscar último monto pagado en el historial de todo el año
            const lastPaid = this.getLastPaidAmount(detectedTax);

            if (lastPaid !== null) {
                // Pendiente, pero tenemos historial (Guardar contexto de confirmación)
                this.context = {
                    pendingAction: "awaiting_confirmation",
                    taxName: detectedTax,
                    month: finalMonth,
                    property: detectedProperty,
                    amount: lastPaid
                };

                let reply = `📋 **Mapeando sistema...** Detecté que **${detectedTax}** ${detectedProperty ? `(en ${detectedProperty})` : ''} está **PENDIENTE** en **${finalMonth}**.<br><br>` +
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

                let reply = `📋 **Mapeando sistema...** Detecté que **${detectedTax}** ${detectedProperty ? `(en ${detectedProperty})` : ''} está **PENDIENTE** en **${finalMonth}**.<br><br>` +
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

    // ====================================================
    // HANDLER: Revisar pendientes agendados en un mes
    // ====================================================
    handlePendingReview(month, propertyName = null) {
        const data = window.database || [];
        const row = data.find(r => r.Mes && r.Mes.trim().toLowerCase() === month.trim().toLowerCase());

        if (!row) {
            return `No encontré datos para el mes de <strong>${month}</strong>. ¿Cargaste algo en ese mes? 🤔`;
        }

        // Buscar todas las celdas con valor que empieza con "p " (pendiente agendado)
        const pendingItems = [];
        let activeTab = propertyName ? propertyName.toLowerCase() : (window.activePropertyTab || 'roca');
        const activeGroups = window.PROPERTY_COLUMN_GROUPS || {};
        const taxes = activeGroups[activeTab] || window.TAX_COLUMNS || [];

        taxes.forEach(tax => {
            const val = row[tax];
            if (val && typeof val === 'string' && val.trim().toLowerCase().startsWith('p ')) {
                const amount = parseFloat(val.trim().substring(2).replace(',', '.'));
                if (!isNaN(amount) && amount > 0) {
                    pendingItems.push({ tax, amount });
                }
            }
        });

        if (pendingItems.length === 0) {
            return `✅ No tenés nada pendiente en <strong>${month}</strong>. ¡Todo al día! 💪`;
        }

        // Armar resumen de todos los pendientes
        const totalPending = pendingItems.reduce((sum, i) => sum + i.amount, 0);
        let listHtml = `📋 Encontré <strong>${pendingItems.length}</strong> pago${pendingItems.length !== 1 ? 's' : ''} pendiente${pendingItems.length !== 1 ? 's' : ''} agendado${pendingItems.length !== 1 ? 's' : ''} en <strong>${month}</strong>:<br><br>`;
        pendingItems.forEach((item, i) => {
            listHtml += `${i + 1}. 🕐 <strong>${item.tax}</strong>: $${item.amount.toLocaleString('es-AR')}<br>`;
        });
        listHtml += `<br>💰 Total pendiente: <strong>$${totalPending.toLocaleString('es-AR')}</strong><br><br>`;
        listHtml += `¿Querés registrar alguno como pago real? Empezamos con el primero:<br>`;
        listHtml += `• <strong>${pendingItems[0].tax}</strong>: $${pendingItems[0].amount.toLocaleString('es-AR')}<br><br>`;
        listHtml += `Respondé <strong>si</strong> para confirmarlo, <strong>no</strong> para saltarlo, o <strong>todos</strong> para confirmar todos de una. 👇`;

        // Guardar contexto para el flujo conversacional uno por uno
        this.context = {
            pendingAction: "reviewing_pending",
            month,
            pendingItems,
            currentIndex: 0
        };

        return listHtml;
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

    triggerImageUpload(event) {
        if (event) {
            event.preventDefault();
            event.stopPropagation();
        }
        const fileInput = document.getElementById('botImageInput');
        if (fileInput) {
            fileInput.value = ''; // Reset to enable triggering change on same file
            fileInput.click();
        }
    }

    handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            // 1. Mostrar la imagen en el chat
            const imgHtml = `<div style="margin-top: 4px;"><img src="${dataUrl}" style="max-width: 100%; max-height: 180px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.15);"></div>`;
            this.appendMessage(imgHtml, 'user');
            
            // 2. Mostrar indicador de pensando
            this.showTypingIndicator();
            
            // 3. Ejecutar reconocimiento OCR
            this.runOcrOnImage(file);
        };
        reader.readAsDataURL(file);
    }

    loadTesseractScript() {
        return new Promise((resolve, reject) => {
            if (window.Tesseract) {
                resolve();
                return;
            }
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
            script.onload = () => resolve();
            script.onerror = (err) => reject(err);
            document.head.appendChild(script);
        });
    }

    async runOcrOnImage(file) {
        if (!window.Tesseract) {
            try {
                await this.loadTesseractScript();
            } catch (err) {
                this.hideTypingIndicator();
                this.appendMessage("⚠️ **Error:** No se pudo cargar el motor OCR. Por favor, verificá tu conexión a internet.", "bot");
                return;
            }
        }

        try {
            const result = await Tesseract.recognize(file, 'spa');
            const text = result.data.text;
            console.log("Texto extraído por OCR:", text);

            const parsed = window.SmartNLPParser.parse(text);
            const detectedAmount = this.extractAmountFromText(text) || parsed.detectedAmount;
            
            let detectedPropertyKey = window.activePropertyTab || 'roca';
            
            if (parsed.detectedProperty) {
                const label = parsed.detectedProperty.toLowerCase();
                if (label.includes('roca') || label.includes('casa')) detectedPropertyKey = 'roca';
                else if (label.includes('moreno')) detectedPropertyKey = 'moreno';
                else if (label.includes('colon')) detectedPropertyKey = 'colon';
                else if (label.includes('gascon')) detectedPropertyKey = 'gascon';
                else if (label.includes('cochera26') || label.includes('cochera 26')) detectedPropertyKey = 'cochera26';
                else if (label.includes('cochera2') || label.includes('cochera 2')) detectedPropertyKey = 'cochera2';
            } else if (parsed.detectedTax) {
                const activeGroups = window.PROPERTY_COLUMN_GROUPS || {};
                for (const [propKey, cols] of Object.entries(activeGroups)) {
                    if (cols.includes(parsed.detectedTax)) {
                        detectedPropertyKey = propKey;
                        break;
                    }
                }
            }

            const detectedTax = parsed.detectedTax;
            const detectedMonth = parsed.detectedMonth || this.getCurrentMonthName();

            this.hideTypingIndicator();
            this.sendOcrResultForm(detectedPropertyKey, detectedTax, detectedAmount, detectedMonth);
        } catch (err) {
            console.error("OCR Error:", err);
            this.hideTypingIndicator();
            this.appendMessage("⚠️ No pude reconocer el texto de la imagen con claridad. ¿Podrías intentar sacándole otra foto más nítida y centrada?", "bot");
        }
    }

    extractAmountFromText(text) {
        let cleaned = text.replace(/\$\s+/g, "$");
        const regex = /\$?(\b\d{1,3}(?:\.\d{3})*(?:,\d{2})?\b|\b\d+(?:\.\d{2})?\b)/g;
        let matches = cleaned.match(regex) || [];
        
        let candidates = [];
        for (let m of matches) {
            let valStr = m.replace('$', '').trim();
            if (valStr.length > 8) continue; // Descartar números muy largos (códigos de barra)
            
            let normalized = valStr;
            if (normalized.includes('.') && normalized.includes(',')) {
                normalized = normalized.replace(/\./g, '').replace(',', '.');
            } else if (normalized.includes(',')) {
                const parts = normalized.split(',');
                if (parts[1].length === 3) {
                    normalized = normalized.replace(/,/g, '');
                } else {
                    normalized = normalized.replace(/,/g, '.');
                }
            } else if (normalized.includes('.')) {
                const parts = normalized.split('.');
                if (parts[1].length === 3) {
                    normalized = normalized.replace(/\./g, '');
                }
            }
            
            const num = parseFloat(normalized);
            if (!isNaN(num) && num > 0 && num !== 2025 && num !== 2026) {
                candidates.push(num);
            }
        }
        
        if (candidates.length === 0) return null;
        
        const lowerText = cleaned.toLowerCase();
        const keywords = ["total", "pagar", "importe", "monto", "vencimiento"];
        
        let bestCandidate = null;
        let minDistance = Infinity;
        
        keywords.forEach(kw => {
            let idx = lowerText.indexOf(kw);
            if (idx !== -1) {
                candidates.forEach(c => {
                    let cStr = c.toString();
                    let cIdx = lowerText.indexOf(cStr, Math.max(0, idx - 100));
                    if (cIdx !== -1) {
                        let dist = Math.abs(cIdx - idx);
                        if (dist < minDistance && dist < 150) {
                            minDistance = dist;
                            bestCandidate = c;
                        }
                    }
                });
            }
        });
        
        if (bestCandidate) return bestCandidate;
        
        const filtered = candidates.filter(c => c < 1000000);
        if (filtered.length > 0) {
            return Math.max(...filtered);
        }
        
        return null;
    }

    sendOcrResultForm(propertyKey, taxName, amount, month) {
        const activeGroups = window.PROPERTY_COLUMN_GROUPS || {};
        
        const properties = [
            { key: "roca", label: "Roca" },
            { key: "moreno", label: "Moreno" },
            { key: "colon", label: "Colon" },
            { key: "gascon", label: "Gascon" },
            { key: "cochera26", label: "Cochera 26" },
            { key: "cochera2", label: "Cochera 2" }
        ];

        let propertyOptions = properties.map(p => 
            `<option value="${p.key}" ${p.key === propertyKey ? 'selected' : ''}>${p.label}</option>`
        ).join('');

        const cols = activeGroups[propertyKey] || window.TAX_COLUMNS || [];
        let taxOptions = cols.map(c => 
            `<option value="${c}" ${c === taxName ? 'selected' : ''}>${c}</option>`
        ).join('');

        let monthOptions = this.MONTHS.map(m => 
            `<option value="${m}" ${m === month ? 'selected' : ''}>${m}</option>`
        ).join('');

        const html = `
            <div class="ocr-result-form" style="display: flex; flex-direction: column; gap: 8px; padding: 4px 0;">
                <div style="font-weight: bold; margin-bottom: 2px;">🔍 Datos detectados en la imagen:</div>
                
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <label style="font-size: 0.7rem; color: #555; font-weight: bold; text-transform: uppercase;">PROPIEDAD</label>
                    <select class="ocr-property-select" onchange="window.botInstance.handleOcrPropertyChange(this)" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.8rem; background: white; outline: none; font-family: inherit;">
                        ${propertyOptions}
                    </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <label style="font-size: 0.7rem; color: #555; font-weight: bold; text-transform: uppercase;">SERVICIO / IMPUESTO</label>
                    <select class="ocr-tax-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.8rem; background: white; outline: none; font-family: inherit;">
                        ${taxOptions}
                    </select>
                </div>

                <div style="display: flex; gap: 8px;">
                    <div style="flex: 1.2; display: flex; flex-direction: column; gap: 2px;">
                        <label style="font-size: 0.7rem; color: #555; font-weight: bold; text-transform: uppercase;">MONTO ($)</label>
                        <input type="number" class="ocr-amount-input" value="${amount || ''}" placeholder="Monto" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.8rem; box-sizing: border-box; background: white; outline: none; font-family: inherit;">
                    </div>
                    <div style="flex: 1; display: flex; flex-direction: column; gap: 2px;">
                        <label style="font-size: 0.7rem; color: #555; font-weight: bold; text-transform: uppercase;">MES</label>
                        <select class="ocr-month-select" style="width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 6px; font-size: 0.8rem; background: white; outline: none; font-family: inherit;">
                            ${monthOptions}
                        </select>
                    </div>
                </div>

                <div style="display: flex; gap: 8px; margin-top: 6px;">
                    <button class="btn-chat-action" style="flex: 1; justify-content: center; background: #25D366; margin: 0; padding: 7px 0; border-radius: 6px; font-size: 0.8rem;" onclick="window.botInstance.saveOcrResult(false, this)">
                        <i class="fa-solid fa-check"></i> Registrar Pago
                    </button>
                    <button class="btn-chat-action" style="flex: 1; justify-content: center; background: #f59e0b; margin: 0; padding: 7px 0; border-radius: 6px; font-size: 0.8rem;" onclick="window.botInstance.saveOcrResult(true, this)">
                        <i class="fa-solid fa-clock"></i> Pendiente
                    </button>
                </div>
            </div>
        `;

        this.appendMessage(html, 'bot');
    }

    handleOcrPropertyChange(selectElement) {
        const form = selectElement.closest('.ocr-result-form');
        if (!form) return;
        const propertyKey = selectElement.value;
        const taxSelect = form.querySelector('.ocr-tax-select');
        if (!taxSelect) return;

        const activeGroups = window.PROPERTY_COLUMN_GROUPS || {};
        const columns = activeGroups[propertyKey] || window.TAX_COLUMNS || [];

        taxSelect.innerHTML = '';
        columns.forEach(col => {
            const option = document.createElement('option');
            option.value = col;
            option.textContent = col;
            taxSelect.appendChild(option);
        });
    }

    saveOcrResult(isPending, btn) {
        const form = btn.closest('.ocr-result-form');
        if (!form) return;

        const taxSelect = form.querySelector('.ocr-tax-select');
        const amountInput = form.querySelector('.ocr-amount-input');
        const monthSelect = form.querySelector('.ocr-month-select');
        const propertySelect = form.querySelector('.ocr-property-select');

        const tax = taxSelect.value;
        const amountVal = amountInput.value;
        const month = monthSelect.value;
        const propertyKey = propertySelect.value;

        const amount = parseFloat(amountVal);
        if (isNaN(amount) || amount <= 0) {
            alert("Por favor, ingresá un monto válido.");
            return;
        }

        // Deshabilitar inputs y botones
        form.querySelectorAll('input, select, button').forEach(el => el.disabled = true);

        // Cambiar estilo del botón pulsado para dar feedback de éxito
        btn.innerHTML = `<i class="fa-solid fa-check-double"></i> ¡Guardado!`;
        if (isPending) {
            btn.style.background = "#d97706";
        } else {
            btn.style.background = "#15803d";
        }

        // Clickea la pestaña de la propiedad para que el usuario visualice el cambio en el tablero principal
        const tabBtn = document.querySelector(`button[onclick*="'${propertyKey}'"]`);
        if (tabBtn) {
            tabBtn.click();
        }

        // Guardar celda en base de datos
        if (window.updateTaxCell) {
            const finalValue = isPending ? `p ${amount}` : amount;
            window.updateTaxCell(month, tax, finalValue);
            
            const statusText = isPending ? 'PENDIENTE' : 'PAGADO';
            const icon = isPending ? '🕐' : '⚡';
            
            const propLabels = {
                "roca": "Roca",
                "moreno": "Moreno",
                "colon": "Colon",
                "gascon": "Gascon",
                "cochera26": "Cochera 26",
                "cochera2": "Cochera 2"
            };
            const propLabel = propLabels[propertyKey] || propertyKey;

            this.appendMessage(
                `${icon} **¡Factura registrada!**<br><br>` +
                `• Servicio: <strong>${tax}</strong><br>` +
                `• Propiedad: <strong>${propLabel}</strong><br>` +
                `• Mes: <strong>${month}</strong><br>` +
                `• Monto: <strong>$${amount.toLocaleString('es-AR')}</strong> (${statusText})<br><br>` +
                `Ya se guardó y actualizó en el tablero de control.`,
                'bot'
            );
        } else {
            alert("Error: No se pudo conectar con el sistema de carga.");
        }
    }
}

// Auto-inicializar cuando el script se cargue
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new BotAsistente());
} else {
    new BotAsistente();
}
