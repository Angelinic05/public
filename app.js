/* ══════════════════════════════════════════
   CONFIGURACIÓN Y VARIABLES GLOBALES
══════════════════════════════════════════ */
const WEBHOOK_URL = 'https://n8n.srv1299698.hstgr.cloud/webhook/club';
const ZOOM_WEBHOOK = 'https://n8n.srv1299698.hstgr.cloud/webhook/zooms';
const WEBHOOK_CHART_URL = 'https://n8n.srv1299698.hstgr.cloud/webhook/asistencia_salas';

let globalAttendanceData = []; 
let myLineChart;
const START_HOUR = 6; 
const TOTAL_HOURS = 16; 

const MASTER_TEACHERS = [
    "CHRISTIAN VELILLA",
    "FELIPE MORENO",
    "PAULA LONDOÑO",
    "FELIPE VALENCIA",
    "CATÁLINA CÓRDOBA",
    "DAVID QUIROGA",
    "ALEJANDRA RIVERA"
];

const teacherPhotos = {
    "CHRISTIAN VELILLA": "images/Chris.jpg",
    "FELIPE MORENO": "images/Moreno.jpg",
    "PAULA LONDOÑO": "images/Paula.jpg",
    "FELIPE VALENCIA": "images/Valencia.jpg",
    "CATÁLINA CÓRDOBA": "images/catalina.png",
    "DAVID QUIROGA": "images/david.jpeg",
    "ALEJANDRA RIVERA": "images/Alejandra.png"
};

const teacherColors = {
    "CHRISTIAN VELILLA": "#e040fb",
    "FELIPE MORENO": "#7b2fff",
    "PAULA LONDOÑO": "#c060f0",
    "FELIPE VALENCIA": "#00ffe5",
    "CATÁLINA CÓRDOBA": "#f2ff00",
    "DAVID QUIROGA": "#ff7300",
    "ALEJANDRA RIVERA": "#ff0008",
};

const today = new Date();
const offset = today.getTimezoneOffset();
const localToday = new Date(today.getTime() - (offset * 60 * 1000));
let selectedDate = today.toLocaleDateString('en-CA'); // en-CA siempre da YYYY-MM-DD
/* ══════════════════════════════════════════
   LOGICA DE NORMALIZACIÓN DE NOMBRES
══════════════════════════════════════════ */
function normalizeName(name) {
    if (!name) return "";
    let n = name.toUpperCase().trim();
    if (n.includes("CHRISTIAN") && n.includes("VELILLA")) return "CHRISTIAN VELILLA";
    if (n.includes("FELIPE") && n.includes("MORENO")) return "FELIPE MORENO";
    if (n.includes("PAULA") && n.includes("LONDOÑO")) return "PAULA LONDOÑO";
    if (n.includes("FELIPE") && n.includes("VALENCIA")) return "FELIPE VALENCIA";
    if (n.includes("CATÁLINA") && n.includes("CÓPRDOBA")) return "CATÁLINA CÓRDOBA";
    if (n.includes("DAVID") && n.includes("QUIROGA")) return "DAVID QUIROGA";
    if (n.includes("ALEJANDRA") && n.includes("RIVERA")) return "ALEJANDRA RIVERA";
    return n.replace(/\./g, "").trim(); 
}

/* ══════════════════════════════════════════
   METODOS DE CARGA (N8N)
══════════════════════════════════════════ */
async function fetchDashboardData() {
    try {
        const response = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fecha_consulta: selectedDate })
        });
        const data = await response.json();
        globalAttendanceData = Array.isArray(data) ? data : (data.logs || []);
        
        console.log("📊 Datos actualizados de la DB");
        initTimeline(); 
        updateWeeklyChart(selectedDate); 
        
    } catch (error) {
        console.error("❌ Error cargando n8n:", error);
    }
}

/* ══════════════════════════════════════════
   TIMELINE (FILAS DIARIAS)
══════════════════════════════════════════ */
function initTimeline() {
    const container = document.getElementById('timelineRows');
    if (!container) return;
    container.innerHTML = '';

    // 1. Filtramos los datos por la fecha seleccionada
    const filteredLogs = globalAttendanceData.filter(log => log.join && log.join.startsWith(selectedDate));

    MASTER_TEACHERS.forEach(teacherName => {
        const teacherLogs = filteredLogs.filter(log => normalizeName(log.name) === teacherName);
        
        // IMPORTANTE: Ordenar para que la lógica de "is-first" e "is-last" sea correcta
        teacherLogs.sort((a, b) => new Date(a.join) - new Date(b.join));

        let totalMinutes = 0;
        let bars = [];

        teacherLogs.forEach((log, index) => {
            const joinDate = new Date(log.join);
            const leaveDate = log.leave ? new Date(log.leave) : new Date();
            
            // Minutos totales desde las 00:00 para comparar con 6AM (360min) y 10PM (1320min)
            const startTotalMin = (joinDate.getHours() * 60 + joinDate.getMinutes());
            const endTotalMin = (leaveDate.getHours() * 60 + leaveDate.getMinutes());

            // Posicionamiento relativo al START_HOUR (6 AM)
            const startMinutesRelative = startTotalMin - (START_HOUR * 60);
            const left = (startMinutesRelative / (TOTAL_HOURS * 60)) * 100;
            
            const durationMin = (leaveDate - joinDate) / (1000 * 60);
            const width = (durationMin / (TOTAL_HOURS * 60)) * 100;

            if (log.leave) totalMinutes += durationMin;

            // --- LÓGICA DE BORDES DINÁMICOS ---
            let borderClasses = "";
            // Redondea izquierda solo si empieza a las 6:00 AM
            if (startTotalMin <= (START_HOUR * 60)) borderClasses += " is-first";
            // Redondea derecha solo si termina a las 10:00 PM (22:00)
            if (endTotalMin >= 22 * 60) borderClasses += " is-last";

            // --- ESTE ES EL RETURN QUE BUSCABAS ---
            bars.push({
                left: Math.max(0, left),
                width: Math.max(0.8, width),
                type: 'bar-gradient' + borderClasses, 
                tooltip: `${joinDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${log.leave ? leaveDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Activo'}`,
                // Texto que aparecerá al pasar el mouse (CSS data-time)
                timeLabel: `${joinDate.getHours()}:${joinDate.getMinutes().toString().padStart(2, '0')} - ${log.leave ? leaveDate.getHours() + ':' + leaveDate.getMinutes().toString().padStart(2, '0') : 'Ahora'}`
            });
        });

        const h = Math.floor(totalMinutes / 60);
        const m = Math.round(totalMinutes % 60);
        renderRow(container, { name: teacherName }, bars, `${h} H ${m < 10 ? '0' + m : m} M`);
    });
}

function renderRow(container, user, bars, duration) {
    const row = document.createElement('div');
    row.className = 't-row';
    const avatarUrl = teacherPhotos[user.name] || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;

    row.innerHTML = `
        <div class="t-user">
            <img class="t-avatar" src="${avatarUrl}" alt="${user.name}">
            <span class="t-name">${user.name}</span>
        </div>
        <div class="t-track">
            ${bars.map(bar => `
                <div class="t-bar ${bar.type}" 
                     style="left: ${bar.left}%; width: ${bar.width}%" 
                     data-time="${bar.timeLabel}" 
                     title="${bar.tooltip}">
                </div>`).join('')}
        </div>
        <div class="t-duration">${duration}</div>
    `;
    container.appendChild(row);
}

/* ══════════════════════════════════════════
   GRAFICO LINEAL (CALCULO POR SEMANA)
══════════════════════════════════════════ */
/* ══════════════════════════════════════════
    GRAFICO LINEAL (ASISTENCIA DIARIA - 15 MIN)
══════════════════════════════════════════ */
async function updateWeeklyChart(dateString) {
    try {
        const response = await fetch(WEBHOOK_CHART_URL, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error(`Error en servidor: ${response.status}`);

        const dataRaw = await response.json();
        const results = Array.isArray(dataRaw) ? dataRaw : [];

        // 1. Generar etiquetas cada 15 minutos: 6:00, 6:15, 6:30, 6:45...
        const labels = [];
        for (let h = 6; h <= 22; h++) {
            labels.push(`${h}:00`);
            if (h < 22) {
                labels.push(`${h}:15`);
                labels.push(`${h}:30`);
                labels.push(`${h}:45`);
            }
        }

        const datasets = MASTER_TEACHERS.map(teacherName => {
            const teacherData = labels.map(timeLabel => {
                const [hLabel, mLabel] = timeLabel.split(':').map(Number);
                
                // 2. Buscamos el registro. 
                // Reducimos el margen a 7 minutos para que sea preciso con los 15 min.
                const record = results.find(item => {
                    if (!item.fecha_muestreo) return false;
                    const itemTime = new Date(item.fecha_muestreo);
                    
                    return normalizeName(item.nombre_completo_profesor) === teacherName &&
                           itemTime.getHours() === hLabel &&
                           Math.abs(itemTime.getMinutes() - mLabel) <= 7;
                });

                return record ? record.total_estudiantes : 0;
            });

            return {
                label: teacherName,
                borderColor: teacherColors[teacherName] || '#fff',
                borderWidth: 2,
                pointRadius: 2, // Puntos un poco más pequeños para no saturar
                fill: false,
                tension: 0.3,
                data: teacherData
            };
        });

        initChart({ labels, datasets });

        const d = new Date(selectedDate + "T00:00:00");
        const rangeText = document.getElementById('weeklyRangeText');
        if(rangeText) rangeText.textContent = "Asistencia: " + d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

    } catch (error) {
        console.error("❌ Error en gráfica:", error);
        initChart({ labels: [], datasets: [] });
    }
}

function initChart(data) {
    const canvas = document.getElementById('lineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const createGradient = (color) => {
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, color + '44'); 
        gradient.addColorStop(1, 'rgba(31, 38, 64, 0)');
        return gradient;
    };

    data.datasets.forEach(ds => { ds.backgroundColor = createGradient(ds.borderColor); });

    if (myLineChart) {
        myLineChart.data = data;
        myLineChart.update();
        return;
    }

    // REGISTRAMOS EL PLUGIN
    Chart.register(ChartDataLabels);

    myLineChart = new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true, 
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 20 // Espacio para que no se corten los números arriba
                }
            },
            plugins: { 
                legend: { display: false }, 
                tooltip: { 
                    mode: 'index', 
                    intersect: false, 
                    backgroundColor: '#1F2640' 
                },
                  datalabels: {
                    align: 'top',
                    anchor: 'end',
                    color: (context) => context.dataset.borderColor,
                    font: { weight: 'bold', size: 10 },
                    formatter: (value) => {
                        return value > 0 ? value : ''; // Solo muestra el número si es mayor a 0
                    }
                }
            },
            scales: {
                y: { 
                    min: 0, 
                    suggestedMax: 12, // Ajusta según el promedio de tus salas
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#5a5580' }
                },
                x: { 
                    ticks: { color: '#ffffff', font: { size: 9 } } 
                }
            }
        }
    });
}

/* ══════════════════════════════════════════
   SELECTORES Y EVENTOS
══════════════════════════════════════════ */
function setupDatePicker() {
    const btn = document.getElementById('datePickerBtn');
    const input = document.getElementById('hiddenDateInput');
    const text = document.getElementById('currentDateText');
    
    if(!input || !btn) return;

    // 1. Sincronizamos el valor inicial del input
    input.value = selectedDate;

    // 2. Sincronizamos el texto inicial del botón con "Hoy"
    const d = new Date(selectedDate + "T00:00:00");
    if(text) text.textContent = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

    btn.addEventListener('click', () => input.showPicker());
    input.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        const d = new Date(selectedDate + "T00:00:00");
        if(text) text.textContent = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
        fetchDashboardData(); 
    });
}

function setupWeeklyPicker() {
    const btn = document.getElementById('weeklyPickerBtn');
    const input = document.getElementById('hiddenWeeklyInput');
    if(btn && input) {
        btn.addEventListener('click', () => input.showPicker());
        input.addEventListener('change', (e) => {
            // Actualiza la gráfica y el texto del botón
            updateWeeklyChart(e.target.value);
        });
    }
}

async function initMeetings() {
    const list = document.getElementById('meetingsList');
    if (!list) return;

    list.innerHTML = '<div style="opacity:.6">Cargando meetings...</div>';

    try {
        const response = await fetch(ZOOM_WEBHOOK, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consulta: "meetings_activos" }) 
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        const meetings = Array.isArray(data) ? data : (data.meetings || []);

        list.innerHTML = '';

        if (meetings.length === 0) {
            list.innerHTML = '<div style="opacity:.6">No hay meetings activos</div>';
            return;
        }

        meetings.forEach(m => {
            // Ahora pasamos m.modo directamente
            const status = mapMeetingStatus(m.modo);
            const teacherName = normalizeName(m.profesor);

            const card = document.createElement('div');
            card.className = 'meeting-card';

            const avatarUrl = teacherPhotos[teacherName] 
                || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.profesor || 'User')}`;

            card.innerHTML = `
                <div class="meeting-card-top">
                    <div class="meeting-topic">${m.nombre || 'Sin sala'}</div>
                    <span class="meeting-badge ${status.badge}">
                        ${status.label}
                    </span>
                </div>

                <div class="meeting-person" style="display:flex; align-items:center; gap:8px;">
                    <img src="${avatarUrl}" 
                        style="width:20px; height:20px; border-radius:50%; object-fit: cover;" />
                    ${teacherName}
                </div>

                <div class="meeting-meta" style="margin-top:6px; font-size:12px; opacity:.7;">
                    ${m.contador_actual || 0} personas
                </div>
            `;

            list.appendChild(card);
        });

    } catch (error) {
        console.error("❌ Error cargando meetings:", error);
        list.innerHTML = '<div style="color:red">Error cargando meetings</div>';
    }
}

/* ══════════════════════════════════════════
    LOGICA DE ESTADOS POR MODO
   ══════════════════════════════════════════ */
function mapMeetingStatus(modo) {
    const m = (modo || '').toLowerCase();

    if (m === 'activa') {
        return { label: 'Activa', badge: 'badge-active' };
    }
    
    if (m === 'break') {
        return { label: 'Break', badge: 'badge-idle' }; // O una clase badge-warning si tienes
    }

    if (m === 'finalizada') {
        return { label: 'Finalizada', badge: 'badge-idle' };
    }

    // Fallback por si llega algo distinto
    return { label: modo, badge: 'badge-idle' };
}

document.addEventListener('DOMContentLoaded', () => {
    setupDatePicker();
    setupWeeklyPicker();
    initMeetings();
    fetchDashboardData();
    setInterval(initMeetings, 30000);
});