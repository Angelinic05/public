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
    "DAVID QUIROGA",
    "ALEJANDRA RIVERA"
];

const teacherPhotos = {
    "CHRISTIAN VELILLA": "images/Chris.jpg",
    "FELIPE MORENO": "images/Moreno.jpg",
    "PAULA LONDOÑO": "images/Paula.jpg",
    "FELIPE VALENCIA": "images/Valencia.jpg",
    "DAVID QUIROGA": "images/david.jpeg",
    "ALEJANDRA RIVERA": "images/Alejandra.png"
};


const teacherColors = {
    "CHRISTIAN VELILLA": "#684EEC",
    "FELIPE MORENO":     "#FCF1C3",
    "PAULA LONDOÑO":     "#02F0E1",
    "FELIPE VALENCIA":   "#ff91ff",
    "DAVID QUIROGA":     "#5FADFF",
    "ALEJANDRA RIVERA":  "#A240EF"
};


const teacherColorsLine = {
    "CHRISTIAN VELILLA": { start: "#684EEC", end: "#684EEC" },
    "FELIPE MORENO":     { start: "#FCF1C3", end: "#FCF1C3" },
    "PAULA LONDOÑO":     { start: "#02F0E1", end: "#02F0E1" },
    "FELIPE VALENCIA":   { start: "#ff91ff", end: "#ff91ff" },
    "DAVID QUIROGA":     { start: "#5FADFF", end: "#5FADFF" },
    "ALEJANDRA RIVERA":  { start: "#A240EF", end: "#A240EF" }
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

            // Todas las barras ahora son redondeadas por defecto para 
            // respetar la estética de la base (t-track)
            let borderClasses = "";
            // Redondea el lado izquierdo si es el primer segmento del profesor
            if (index === 0) borderClasses += " is-first";
            // Redondea el lado derecho si es el último segmento del profesor
            if (index === teacherLogs.length - 1) borderClasses += " is-last";

            const colors = teacherColorsLine[teacherName] || { start: "#b76fff", end: "#4a237a" };

            // Pasamos AMBOS colores como variables CSS
            const gradientVars = `--color-start: ${colors.start}; --color-end: ${colors.end};`;

            bars.push({
                left: Math.max(0, left),
                width: Math.max(0.8, width),
                type: borderClasses, 
                customStyle: gradientVars, // Inyectamos las variables
                tooltip: `${joinDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${log.leave ? leaveDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Activo'}`,
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
    // AÑADIMOS ESTO: Atributo para identificar al profesor en el hover
    row.setAttribute('data-teacher', user.name); 
    
    const avatarUrl = teacherPhotos[user.name] || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}`;

    row.innerHTML = `
        <div class="t-user">
            <img class="t-avatar" src="${avatarUrl}" alt="${user.name}">
            <span class="t-name">${user.name}</span>
        </div>
        <div class="t-track">
            ${bars.map(bar => `
                <div class="t-bar ${bar.type}" 
                     style="left: ${bar.left}%; width: ${bar.width}%; ${bar.customStyle}" 
                     data-time="${bar.timeLabel}" 
                     title="${bar.tooltip}">
                </div>`).join('')}
        </div>
        <div class="t-duration">${duration}</div>
    `;
    
    // AÑADIMOS ESTOS EVENTOS:
    row.addEventListener('mouseenter', () => highlightLine(user.name));
    row.addEventListener('mouseleave', () => resetLines());
    
    container.appendChild(row);
}



/* ══════════════════════════════════════════
    LÓGICA DE RESALTADO DEL GRÁFICO
   ══════════════════════════════════════════ */

/* ══════════════════════════════════════════
    LÓGICA DE RESALTADO DEL GRÁFICO (ACTUALIZADA)
   ══════════════════════════════════════════ */
/* ══════════════════════════════════════════
    LÓGICA DE RESALTADO DEL GRÁFICO (ACTUALIZADA)
   ══════════════════════════════════════════ */
function highlightLine(teacherName) {
    if (!myLineChart) return;

    const color = teacherColors[teacherName] || '#fff';

    myLineChart.data.datasets.forEach((dataset) => {
        if (dataset.label === teacherName) {
            // ESTADO ACTIVO
            dataset.showLabels = true;
            dataset.borderWidth = 5;
            dataset.borderColor = color;
            // Degradado dinámico para la línea resaltada
            dataset.backgroundColor = (context) => {
                const chart = context.chart;
                const {ctx, chartArea} = chart;
                if (!chartArea) return null;
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, color + '80'); // 0.5 de opacidad arriba
                gradient.addColorStop(0.5, color + '1A'); // Casi transparente a la mitad
                gradient.addColorStop(1, 'transparent');  // Totalmente transparente en el eje X
                return gradient;
            };

            // Puntos: visibles y con color (tamaño grande al seleccionar)
            dataset.pointStyle = 'circle';
            dataset.pointRadius = 2.5;
            dataset.pointHoverRadius = 4;
            dataset.pointHitRadius = 4;
            dataset.pointBorderWidth = 2;
            dataset.pointHoverBorderWidth = 2;
            dataset.pointBackgroundColor = teacherColors[teacherName];
            dataset.pointBorderColor = teacherColors[teacherName];
            dataset.pointHoverBackgroundColor = teacherColors[teacherName];
            dataset.pointHoverBorderColor = teacherColors[teacherName];
        } else {
            const datasetColor = teacherColors[dataset.label] || '#fff';
            dataset.showLabels = false;
            dataset.borderWidth = 2;
            dataset.borderColor = 'rgba(255, 255, 255, 0.13)'; // Modifica este color para las líneas opacas
            dataset.backgroundColor = (context) => {
                const chart = context.chart;
                const {ctx, chartArea} = chart;
                if (!chartArea) return null;
                const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                gradient.addColorStop(0, 'rgba(255, 255, 255, 0.14)'); // Modifica el relleno opaco
                gradient.addColorStop(1, 'transparent');
                return gradient;
            };
            dataset.pointStyle = 'circle';
            dataset.pointRadius = 0;
            dataset.pointHoverRadius = 0;
            dataset.pointHitRadius = 0;
            dataset.pointBorderWidth = 0;
            dataset.pointHoverBorderWidth = 0;
            dataset.pointBackgroundColor = 'transparent';
            dataset.pointBorderColor = 'transparent';
            dataset.pointHoverBackgroundColor = 'transparent';
            dataset.pointHoverBorderColor = 'transparent';
        }
    });

    // 'active' en lugar de 'none' para que Chart.js aplique TODOS los cambios de estilo
    myLineChart.update('active');
}

function resetLines() {
    if (!myLineChart) return;

    myLineChart.data.datasets.forEach((dataset) => {
        const teacherName = dataset.label;
        const color = teacherColors[teacherName] || '#fff';

        dataset.showLabels = false;
        dataset.borderWidth = 2;
        dataset.borderColor = color;
        dataset.backgroundColor = (context) => {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, color + '4D'); // 0.3 de opacidad arriba
            gradient.addColorStop(0.6, color + '0D'); // Desvanece rápido
            gradient.addColorStop(1, 'transparent');  // Transparente en el eje X
            return gradient;
        };

        // Restaurar puntos: sin puntos (solo líneas)
        dataset.pointStyle = 'circle';
        dataset.pointRadius = 0;
        dataset.pointHoverRadius = 0;
        dataset.pointHitRadius = 0;
        dataset.pointBorderWidth = 0;
        dataset.pointHoverBorderWidth = 0;
        dataset.pointBackgroundColor = 'transparent';
        dataset.pointBorderColor = 'transparent';
        dataset.pointHoverBackgroundColor = 'transparent';
        dataset.pointHoverBorderColor = 'transparent';
    });

    myLineChart.update('active');
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

        const text = await response.text();
        const dataRaw = text ? JSON.parse(text) : [];
        const results = Array.isArray(dataRaw) ? dataRaw : [];

        // 1. Generar etiquetas cada 15 minutos: 6:00 a 22:00
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
                
                const record = results.find(item => {
                    if (!item.fecha_muestreo) return false;

                    // Validar que el registro pertenezca al día seleccionado en el dash
                    // (item.fecha_muestreo suele ser YYYY-MM-DD...)
                    if (!item.fecha_muestreo.startsWith(selectedDate)) return false;

                    let itemTime = new Date(item.fecha_muestreo);
                    
                    // Si el string contiene 'Z', JS lo asume UTC. 
                    // Sumamos 5 horas para normalizar a hora Colombia en el gráfico.
                    if (item.fecha_muestreo.includes('Z')) {
                        itemTime.setHours(itemTime.getHours() + 7);
                    }
                    
                    // Usamos la nueva propiedad "profesor"
                    return normalizeName(item.profesor) === teacherName &&
                        itemTime.getHours() === hLabel &&
                        Math.abs(itemTime.getMinutes() - mLabel) <= 7;
                });

                return record ? record.total_estudiantes : 0;
            });

            const colorHex = teacherColors[teacherName] || '#fff';
            return {
                label: teacherName,
                borderColor: colorHex,
                backgroundColor: colorHex + '1A',
                pointBackgroundColor: colorHex,
                pointBorderColor: colorHex,
                borderWidth: 2,
                pointRadius: 0,
                fill: 'origin',
                tension: 0.3,
                data: teacherData
            };
        });

        initChart({ labels, datasets });

        const d = new Date(selectedDate + "T00:00:00");
        const rangeText = document.getElementById('weeklyRangeText');
        if(rangeText) rangeText.textContent = "" + d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

    } catch (error) {
        console.error("❌ Error en gráfica:", error);
        initChart({ labels: [], datasets: [] });
    }
}

function initChart(data) {
    const canvas = document.getElementById('lineChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Aplicar degradado inicial a cada dataset
    data.datasets.forEach(ds => {
        const color = ds.borderColor;
        ds.backgroundColor = (context) => {
            const chart = context.chart;
            const {ctx, chartArea} = chart;
            if (!chartArea) return null;
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            gradient.addColorStop(0, color + '4D'); 
            gradient.addColorStop(0.6, color + '0D');
            gradient.addColorStop(1, 'transparent');
            return gradient;
        };
    });

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
                    top: 10 // Espacio para que no se corten los números arriba
                }
            },
            plugins: { 
                legend: { display: false }, 
                title: {
                    display: true,
                    text: 'ASISTENCIA',
                    color: '#ffffff',
                    align: 'center', // Lo alinea a la izquierda
                    padding: {
                        top: 0,
                        bottom: 20
                    },
                    font: {
                        family: 'Montserrat',
                        size: 15,
                        weight: '600'
                    }
                },
                tooltip: { 
                    mode: 'index', 
                    intersect: false, 
                    backgroundColor: 'rgba(26, 9, 51, 0.95)', // Morado profundo para el fondo
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    titleFont: { family: 'Montserrat', size: 12, weight: 'bold' },
                    bodyFont: { family: 'Montserrat', size: 12 },
                    padding: 5,
                    cornerRadius: 10,
                    bodySpacing: 10,
                    titleSpacing: 10,
                    // --- ESTA ES LA MAGIA PARA LOS CÍRCULOS ---
                    usePointStyle: true, // Cambia el cuadrado por el estilo del punto (círculo)
                    boxWidth: 10,        // Círculos de color más grandes
                    boxHeight: 10,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y;
                            }
                            return label;
                        },
                        // Forzamos a que use el color de la línea como fondo del círculo
                        labelColor: function(context) {
                            return {
                                borderColor: context.dataset.borderColor,
                                backgroundColor: context.dataset.borderColor, // Círculo sólido
                                borderWidth: 0,
                                borderRadius: 2 // Redondeo máximo para que sea círculo
                            };
                        }
                    }
                },
                  // --- DENTRO DE initChart, en la sección datalabels ---
                datalabels: {
                    // Esta función decide si mostrar o no el número
                    display: function(context) {
                        // Buscamos una propiedad 'showLabels' que activaremos por código
                        return context.dataset.showLabels === true; 
                    },
                    align: 'top',
                    anchor: 'end',
                    offset: -5,
                    color: (context) => context.dataset.borderColor,
                    font: { size: 15 },
                    formatter: (value) => {
                        return value > 0 ? value : ''; 
                    }
                }
            },
            scales: {
                y: { 
                    min: 0, 
                    suggestedMax: 12,
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { color: '#f5f5f5' }
                },
                x: { 
                    grid: { color: 'rgba(255,255,255,0.05)' },
                    ticks: { 
                        color: '#ffffff', 
                        font: { size: 11 },
                        maxRotation: 90,
                        minRotation: 90 
                    }
                    
                }
            }
        }
    });
}

/* ══════════════════════════════════════════
   SELECTORES Y EVENTOS
══════════════════════════════════════════ */



async function initMeetings() {
    const list = document.getElementById('meetingsList');
    if (!list) return;

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

                <div class="meeting-meta contador">
                    ${m.contador_actual || 0} personas
                </div>
            `;

            list.appendChild(card);
        });

    } catch (error) {
        console.error("❌ Error cargando meetings:", error);
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



/* ══════════════════════════════════════════
   SELECTORES Y EVENTOS UNIFICADOS
══════════════════════════════════════════ */

function setupUnifiedDatePicker() {
    // Usamos el botón del gráfico (el de arriba) como único control
    const btn = document.getElementById('weeklyPickerBtn');
    const input = document.getElementById('hiddenWeeklyInput');
    const text = document.getElementById('weeklyRangeText');
    
    if(!input || !btn) return;

    // Sincronizar valor inicial
    input.value = selectedDate;

    // Función para actualizar TODO el dashboard
    const updateAll = (newDate) => {
        selectedDate = newDate;
        
        // 1. Actualizar texto visual del botón superior
        const d = new Date(selectedDate + "T00:00:00");
        if(text) text.textContent = "Asistencia: " + d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });

        // 2. Disparar recarga de datos (esto actualiza el Timeline y luego el Gráfico)
        fetchDashboardData(); 
    };

    btn.addEventListener('click', () => input.showPicker());
    
    input.addEventListener('change', (e) => {
        updateAll(e.target.value);
    });
}

// Al final de tu archivo, en el DOMContentLoaded, cambia las llamadas:
document.addEventListener('DOMContentLoaded', () => {
    setupUnifiedDatePicker(); 
    initMeetings();
    fetchDashboardData();
    setInterval(initMeetings, 30000);
});