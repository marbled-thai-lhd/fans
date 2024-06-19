const d = document;
const dc = e => d.createElement(e);
const dgID = e => d.getElementById(e);
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(script);

const cE = (n, id, clN, txt) => {
	const e = dc(n);
	id && (e.id = id);
	clN && e.classList.add(clN);
	txt && (e.textContent = txt);
	return e;
}

const cT = (txt, id, unit = ' °C') => {
	const d = cE('div', undefined, undefined, txt);
	const s = cE('span', id, undefined, 0);
	d.appendChild(s);
	d.innerHTML += unit;
	return d;
}

const cW = (canvasId, labelId, full) => {
	const wrapper = document.createElement('div');
	wrapper.classList.add('chart-wrapper');
	wrapper.classList.add(full ? 'full' : 'auto');

	const canvas = document.createElement('canvas');
	canvas.id = canvasId;

	const label = document.createElement('div');
	label.classList.add('chart-label');
	label.id = labelId;
	label.textContent = '';

	wrapper.appendChild(canvas);
	wrapper.appendChild(label);

	return wrapper;
}

const main = function () {
	if (typeof Chart === "undefined") return setTimeout(main, 200);
	const container = cE('div', 'container', 'container');
	container.appendChild(cE('h1',undefined,undefined,'Temperature and Fan Control'));

	const chartContainer = cE('div', undefined, 'chart-container');
	chartContainer.appendChild(cW('temp1Chart', 'temp1Label'));
	chartContainer.appendChild(cW('temp2Chart', 'temp2Label'));
	chartContainer.appendChild(cW('pwmChart', 'fanPercentLabel'));
	container.appendChild(chartContainer);

	const form = cE('form', 'control-form');
	const groupSetting = cE('div', undefined, 'flex-box')
	const controlButtons = cE('div', 'control-buttons', 'toggle');
	
	const chkAuto = cE('input', 'choice1');
	chkAuto.name = 'mode';
	chkAuto.value = "auto"
	chkAuto.type = 'radio';
	controlButtons.appendChild(chkAuto);
	const lblFor1 = cE('label', undefined, undefined, "Auto")
	lblFor1.htmlFor = 'choice1';
	controlButtons.appendChild(lblFor1);

	const chkManual = cE('input', 'choice2');
	chkManual.name = 'mode';
	chkManual.value = "manual"
	chkManual.type = 'radio';
	controlButtons.appendChild(chkManual);
	const lblFor2 = cE('label', undefined, undefined, "Manual")
	lblFor2.htmlFor = 'choice2';
	controlButtons.appendChild(lblFor2);

	const flap = cE('div', 'flap');
	flap.appendChild(cE('span', undefined, 'content'))
	controlButtons.appendChild(flap);
	groupSetting.appendChild(controlButtons);

	const pwm = cE('input', 'pwm-slider');
	pwm.type = 'range';
	pwm.min = '0';
	pwm.max = '255';
	pwm.value = _i.f;
	pwm.name = 'pwm';
	groupSetting.appendChild(pwm);
	form.appendChild(groupSetting);
	form.appendChild(cE('button', undefined, undefined, 'Setting'));
	container.appendChild(form);

	const chartButton = cE('button', undefined, undefined, 'Draw Chart');
	chartButton.addEventListener('click', () => {
		fetch('http://192.168.1.177:3000/json')
			.then(response => response.json())
			.then(data => {
				const oneMinute = 60 * 1000;
				data.forEach(e => e.r1 == 1 ? f = 0 : '');
				data = data.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
					.reduce((acc, item) => {
						const currentTimestamp = new Date(item.timestamp).getTime();
						if (item.r1 == 1) item.f = 0;
						if (acc.length === 0 || currentTimestamp >= acc[acc.length - 1].timestamp + oneMinute) {
							acc.push({ ...item, timestamp: currentTimestamp });
						}
						return acc;
					}, [])
					.map(item => {
						return { ...item, timestamp: new Date(item.timestamp).toISOString() };
					});
				const labels = data.map(item => item.timestamp.substr(11,8));
				const temp1Data = data.map(item => item.i);
				const temp2Data = data.map(item => item.e);
				const fanSpeedData = data.map(item => item.f);
				const lineChartWarpper = cW('lineChart', 'lineLabel', 1);
				document.body.appendChild(lineChartWarpper);
				const ctx = dgID('lineChart').getContext('2d');
				new Chart(ctx, {
					type: 'line',
					data: {
						labels: labels,
						datasets: [
							{
								label: 'Inverter',
								data: temp1Data,
								borderColor: 'red',
								fill: false,
								yAxisID: 'y'
							},
							{
								label: 'Environment',
								data: temp2Data,
								borderColor: 'blue',
								fill: false,
								yAxisID: 'y',
							},
							{
								label: 'Fan Speed',
								data: fanSpeedData,
								borderColor: 'green',
								fill: false,
								yAxisID: 'y1',
							}
						]
					},
					options: {
						responsive: true,
						scales: {
							x: {
								display: true,
								title: {
									display: true,
									text: 'Timestamp'
								}
							},
							y1: {
								display: true,
								max: 260,
								title: {
									display: true,
									text: 'PWM'
								}
							},
							y: {
								display: true,
								min: Math.min(...temp1Data, ...temp2Data) - 0.5,
								max: Math.max(...temp1Data, ...temp2Data) + 0.5,
								title: {
									display: true,
									text: '°C'
								},
								position: 'right',
							}
						}
					}
				});
			});
	});
	container.appendChild((chartButton.style.margin = '20px 20px 0 0', chartButton));
	const lcd = cE('button', undefined, undefined, 'LCD on');
	lcd.addEventListener('click', () => {
		fetch('/?lightOn=1');
		setInterval(() => {
			fetch('/?lightOn=1')
		}, 60000)
		lcd.disabled= true;
	});
	container.appendChild(lcd);
	d.body.appendChild(container);
	updateValue(_i);
	fetch('http://192.168.1.177:3000/max-min')
	.then(response => response.json())
	.then(data => {
		data = data[0];
		window['temp1Chart'].options.max = data.mxi + 0.5;
		window['temp1Chart'].options.min = data.mni - 0.5;
		window['temp1Chart'].update();
		window['temp2Chart'].options.max = data.mxe + 0.5;
		window['temp2Chart'].options.min = data.mne - 0.5;
		window['temp2Chart'].update();
	});
	([lblFor1, lblFor2]).forEach(e => e.addEventListener('click', e => setTimeout(() => {
		dgID('flap').children[0].textContent = e.target.textContent;
	}, 200)));
};
const updateValue = (data, flag) => {
	updateChart('temp1Chart', data.i, flag);
	updateChart('temp2Chart', data.e, flag);
	updateChart('pwmChart', data.r1 == 1 ? 0 : data.f, flag);
	if (!flag) modeUpdate(data.a == 1);
}

const modeUpdate = (auto) => {
	const modeInput = d.querySelector(`[name="mode"][value="${auto ? 'auto' : 'manual'}"]`);
	modeInput.check = true;
	modeInput.nextElementSibling.click();
	dgID('flap').children[0].textContent = modeInput.nextElementSibling.textContent;
}

const temperatureToColor = (temperature, coolTemp = 35, hotTemp = 45) => {
	temperature = Math.max(coolTemp, Math.min(hotTemp, temperature));
	const factor = (temperature - coolTemp) / (hotTemp - coolTemp);
	const hue = (1 - factor) * 240; // 240 degrees is blue, 0 degrees is red
	const rgb = hsvToRgb(hue, 1, 1); // Full saturation and value
	return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }
  
function hsvToRgb(h, s, v) {
let r, g, b;

const i = Math.floor(h / 60);
const f = h / 60 - i;
const p = v * (1 - s);
const q = v * (1 - f * s);
const t = v * (1 - (1 - f) * s);

switch (i % 6) {
	case 0: r = v, g = t, b = p; break;
	case 1: r = q, g = v, b = p; break;
	case 2: r = p, g = v, b = t; break;
	case 3: r = p, g = q, b = v; break;
	case 4: r = t, g = p, b = v; break;
	case 5: r = v, g = p, b = q; break;
}

return {
	r: Math.round(r * 255),
	g: Math.round(g * 255),
	b: Math.round(b * 255)
};
}

function getColorForPwm(value) {
	const red = Math.min(255, Math.floor(255 * value / 255));
	const green = Math.min(255, Math.floor(255 * (255 - value) / 255));
	return `rgb(${red},${green},0)`;
}

const updateChart = (id, value, update = false) => {
	const map = {
		temp1Chart: {
			data: [0, 100],
			backgroundColor: ['#FF5733', '#e0e0e0'],
			innerText: v => `${v}°C`,
			label: 'temp1Label',
			color: temperatureToColor(value)
		},
		temp2Chart: {
			data: [0, 100],
			backgroundColor: ['#33B5FF', '#e0e0e0'],
			innerText: v => `${v}°C`,
			label: 'temp2Label',
			color: temperatureToColor(value)
		},
		pwmChart: {
			data: [0, 100],
			backgroundColor: ['#4CAF50', '#e0e0e0'],
			innerText: v => `${Math.round(v / 255 * 10000) / 100}%`,
			label: 'fanPercentLabel',
			color: temperatureToColor(value, 0, 255)
		}
	}

	if (!update) {
		const temp1Ctx = dgID(id).getContext('2d');
		window[id] = new Chart(temp1Ctx, {
			type: 'doughnut',
			data: {
				datasets: [{
					data: map[id].data,
					backgroundColor: map[id].backgroundColor,
					borderWidth: 0
				}]
			},
			options: {
				max: map[id].data[1],
				min: map[id].data[0],
				rotation: -90,
				circumference: 180,
				cutout: '80%',
				plugins: {
					tooltip: { enabled: false },
					legend: { display: false }
				},
			}
		});
	}

	const {min, max} = window[id].options;

	window[id].data.datasets[0].backgroundColor[0] = map[id].color;
	window[id].data.datasets[0].data[0] = id == 'pwmChart' ? (value / 2.55) : ((value - min) / (max - min)) * 100;
	window[id].data.datasets[0].data[1] = max -  window[id].data.datasets[0].data[0];
	window[id].update();
	dgID(map[id].label).innerText = map[id].innerText(value);
}

setInterval(function () {
	fetch('http://192.168.1.50/json')
		.then(response => response.text())
		.then(d => {
			const data = JSON.parse(`${d.replace(/([a-z0-9]+):/g, '"$1": ')}`)
			updateValue(data, true);
		})
}, 5000);

document.addEventListener('DOMContentLoaded', main);

document.addEventListener('DOMContentLoaded', function () {
	// Create a <style> element
	const styleElement = cE('style');
	document.head.appendChild(styleElement);

	// Define CSS rules as strings
	const css = `
		:root {
			--accent: #3498db;
			--border-width: 6px;
			--border-radius: 55px;
		}
		*{
			margin: 0;
			padding: 0;
		}
        body {
            font-family: Arial, sans-serif;
            margin: 0;
			margin: 20px;
            background-color: #f0f0f0;
        }

        .container {
            width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
        }
		.flex-box {
			display: flex;
			margin-bottom: 10px;
		}
        h1 {
            text-align: center;
        }

        .temperature-values {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .control-buttons {
            display: flex;
            justify-content: space-around;
            margin-bottom: 20px;
        }

        #manual-controls {
            margin-bottom: 20px;
        }

        #pwm-slider {
            width: calc(100% - 200px);
			margin-left: 10px;
        }

        .chart-container {
            display: flex;
            justify-content: space-around;
            margin-bottom: 20px;
        }

        .chart-wrapper {
            position: relative;
            width: 150px;
            height: 150px;
        }

		.full.chart-wrapper {
            position: relative;
            width: calc(100vw - 80px);
            height: 100vh;
        }

        .chart-wrapper canvas {
            width: 100%;
            height: 100%;
        }

        .chart-label {
            position: absolute;
            top: 70%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 1.2rem;
            pointer-events: none;
        }
		button {
			padding: 10px 20px;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            color: #ffffff;
            background-color: var(--accent);
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s ease;
		}
		.toggle {
			position: relative;
			border: solid var(--border-width) var(--accent);
			border-radius: var(--border-radius);
			transition: transform cubic-bezier(0, 0, 0.30, 2) .4s;
			transform-style: preserve-3d;
			perspective: 800px;
			width: 170px;
		}

		.toggle>input[type="radio"] {
			display: none;
		}

		.toggle>#choice1:checked~#flap {
			transform: rotateY(-180deg);
		}

		.toggle>#choice1:checked~#flap>.content {
			transform: rotateY(-180deg);
		}

		.toggle>#choice2:checked~#flap {
			transform: rotateY(0deg);
		}

		.toggle>label {
			display: inline-block;
			min-width: 75px;
			padding: 5px;
			font-size: var(--font-size);
			text-align: center;
			color: var(--accent);
			cursor: pointer;
		}

		.toggle>label,
		.toggle>#flap {
			font-weight: bold;
			text-transform: capitalize;
		}

		.toggle>#flap {
			position: absolute;
			top: calc( 0px - var(--border-width));
			left: 50%;
			height: calc(100% + var(--border-width) * 2);
			width: 50%;
			display: flex;
			justify-content: center;
			align-items: center;
			font-size: var(--font-size);
			background-color: var(--accent);
			border-top-right-radius: var(--border-radius);
			border-bottom-right-radius: var(--border-radius);
			transform-style: preserve-3d;
			transform-origin: left;
			transition: transform cubic-bezier(0.4, 0, 0.2, 1) .5s;
		}

		.toggle>#flap>.content {
			color: #333;
			transition: transform 0s linear .25s;
			transform-style: preserve-3d;
		}
		@media only screen and (max-width: 1100px) {
			button {
				font-size: 30px;
				padding: 20px;
			}
			.toggle>label, .toggle>#flap {
				font-size: 30px;
			}
			#control-buttons {
				margin-bottom: 20px;
			}
			.toggle>label {
				min-width: 180px;
			}
			.toggle {
				width: 550px;
			}
			.container {
				width: calc(100vw - 80px);
			}
			.chart-wrapper {
				position: relative;
				width: 45%;
				height: auto;
			}
			.temperature-values{
				flex-direction: column;
			    justify-content: left;
    			align-items: start;
				margin-top: 40px;
				margin-bottom: 0px;
			}
			.chart-container {
				flex-wrap: wrap;
			}
			.full.chart-wrapper {
				width: 500vw;
				height: auto:
			}
		}
    `;

	// Set the CSS text of the <style> element
	styleElement.appendChild(document.createTextNode(css));
});


