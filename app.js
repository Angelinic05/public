/* ══════════════════════════════════════════
   CONFIGURACIÓN Y VARIABLES GLOBALES
══════════════════════════════════════════ */
const WEBHOOK_URL = 'https://n8n.srv1299698.hstgr.cloud/webhook/club';
let globalAttendanceData = []; 
let myLineChart;
const START_HOUR = 6; 
const TOTAL_HOURS = 16; 

const MASTER_TEACHERS = [
    "CHRISTIAN VELILLA",
    "FELIPE MORENO",
    "PAULA LONDOÑO",
    "FELIPE VALENCIA"
];

const teacherPhotos = {
    "CHRISTIAN VELILLA": "images/Chris.jpg",
    "FELIPE MORENO": "images/Moreno.jpg",
    "PAULA LONDOÑO": "images/Paula.jpg",
    "FELIPE VALENCIA": "images/Valencia.jpg"
};

const teacherColors = {
    "CHRISTIAN VELILLA": "#e040fb",
    "FELIPE MORENO": "#7b2fff",
    "PAULA LONDOÑO": "#c060f0",
    "FELIPE VALENCIA": "#00ffe5"
};

const today = new Date();
const offset = today.getTimezoneOffset();
const localToday = new Date(today.getTime() - (offset * 60 * 1000));
let selectedDate = localToday.toISOString().split('T')[0];

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

    // Filtramos los datos por la fecha seleccionada
    const filteredLogs = globalAttendanceData.filter(log => log.join && log.join.startsWith(selectedDate));

    MASTER_TEACHERS.forEach(teacherName => {
        const teacherLogs = filteredLogs.filter(log => normalizeName(log.name) === teacherName);
        
        // IMPORTANTE: Ordenar los logs por hora de inicio para que la lógica de bordes funcione
        teacherLogs.sort((a, b) => new Date(a.join) - new Date(b.join));

        let totalMinutes = 0;
        let bars = [];

        teacherLogs.forEach(log => {
            const joinDate = new Date(log.join);
            const leaveDate = log.leave ? new Date(log.leave) : new Date();
            
            // Calculamos minutos totales del día para validar bordes
            const startTotalMinutes = (joinDate.getHours() * 60 + joinDate.getMinutes());
            const endTotalMinutes = (leaveDate.getHours() * 60 + leaveDate.getMinutes());

            // Posicionamiento relativo al START_HOUR (6 AM)
            const startMinutesRelative = startTotalMinutes - (START_HOUR * 60);
            const left = (startMinutesRelative / (TOTAL_HOURS * 60)) * 100;
            
            const durationMin = (leaveDate - joinDate) / (1000 * 60);
            const width = (durationMin / (TOTAL_HOURS * 60)) * 100;

            if (log.leave) totalMinutes += durationMin;

            // LÓGICA DE BORDES DINÁMICOS
            let borderClasses = "";
            // Redondea izquierda solo si empieza a las 6:00 AM o antes
            if (startTotalMinutes <= (START_HOUR * 60)) borderClasses += " is-first";
            // Redondea derecha solo si termina a las 10:00 PM (22:00) o después
            if (endTotalMinutes >= 22 * 60) borderClasses += " is-last";

            bars.push({
                left: Math.max(0, left),
                width: Math.max(0.8, width),
                type: 'bar-gradient' + borderClasses, 
                tooltip: `${joinDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} - ${log.leave ? leaveDate.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Activo'}`
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
    const photoFileName = teacherPhotos[user.name];
    const avatarUrl = photoFileName ? photoFileName : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3a3760&color=fff&bold=true`;

    row.innerHTML = `
        <div class="t-user">
            <img class="t-avatar" src="${avatarUrl}" alt="${user.name}" onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=3a3760&color=fff'">
            <span class="t-name">${user.name}</span>
        </div>
        <div class="t-track">
            ${bars.map(bar => `<div class="t-bar ${bar.type}" style="left: ${bar.left}%; width: ${bar.width}%" title="${bar.tooltip}"></div>`).join('')}
        </div>
        <div class="t-duration">${duration}</div>
    `;
    container.appendChild(row);
}

/* ══════════════════════════════════════════
   GRAFICO LINEAL (CALCULO POR SEMANA)
══════════════════════════════════════════ */
function updateWeeklyChart(dateString) {
    const date = new Date(dateString + "T00:00:00");
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    // --- ACTUALIZAR TEXTO DEL BOTÓN ---
    const weeklyText = document.getElementById('weeklyRangeText');
    if (weeklyText) {
        const options = { day: 'numeric' };
        const monthOption = { month: 'long' };
        const rangeText = `${monday.toLocaleDateString('es-ES', options)} - ${sunday.toLocaleDateString('es-ES', options)} ${sunday.toLocaleDateString('es-ES', monthOption)}`;
        weeklyText.textContent = rangeText;
    }

    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
    }

    const newData = {
        labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
        datasets: MASTER_TEACHERS.map(teacherName => {
            const dataByDay = weekDates.map(currentDate => {
                const dayLogs = globalAttendanceData.filter(log => 
                    normalizeName(log.name) === teacherName && 
                    log.join && log.join.startsWith(currentDate)
                );
                let totalMin = 0;
                dayLogs.forEach(log => {
                    if (log.join && log.leave) {
                        const duration = (new Date(log.leave) - new Date(log.join)) / (1000 * 60);
                        totalMin += duration;
                    }
                });
                return parseFloat((totalMin / 60).toFixed(1)); 
            });
            return {
                label: teacherName,
                borderColor: teacherColors[teacherName],
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                data: dataByDay
            };
        })
    };
    initChart(newData);
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
                      offset: 4,
                      color: (context) => context.dataset.borderColor,
                      font: {
                          family: 'Montserrat',
                          weight: 'bold',
                          size: 10 
                      },

                      formatter: (value) => {
                          if (!value || value <= 0) return ''; 

                          const hours = Math.floor(value);
                          const minutes = Math.round((value - hours) * 60);

                          if (minutes === 0) return `${hours}H`;
                          
                          return `${hours}H ${minutes < 10 ? '0' + minutes : minutes}M`;
                      }
                  }
            },
            scales: {
                y: { 
                    min: 0, 
                    max: 16, 
                    grid: { color: 'rgba(255,255,255,0.03)' }, 
                    ticks: { color: '#5a5580' } 
                },
                x: { 
                    grid: { display: false }, 
                    ticks: { color: '#8880b0' } 
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
    input.value = selectedDate;
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

function initMeetings() {
    const list = document.getElementById('meetingsList');
    if (!list) return;
    list.innerHTML = '';
    const tempMeetings = [
        { topic: 'Q1 Strategy Planning', person: 'Christian Velilla', status: 'Active', badge: 'badge-active' },
        { topic: 'English Level B2 - Session 4', person: 'Paula Londoño', status: 'Active', badge: 'badge-active' },
        { topic: 'Teacher Sync - Weekly', person: 'Felipe Moreno', status: 'Break', badge: 'badge-break' },
        { topic: 'Onboarding New Students', person: 'Felipe Valencia', status: 'Active', badge: 'badge-active' }
    ];
    tempMeetings.forEach(m => {
        const card = document.createElement('div');
        card.className = 'meeting-card';
        card.innerHTML = `<div class="meeting-card-top"><div class="meeting-topic">${m.topic}</div><span class="meeting-badge ${m.badge}">${m.status}</span></div><div class="meeting-person">${m.person}</div>`;
        list.appendChild(card);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setupDatePicker();
    setupWeeklyPicker();
    initMeetings();
    fetchDashboardData(); 
});