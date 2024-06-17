const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
document.head.appendChild(script);
const main = function () {
	if (typeof Chart === "undefined") return setTimeout(main, 200);
	// Create main elements
	const container = document.createElement('div');
	container.id = 'container';
	container.classList.add('container');

	const h1 = document.createElement('h1');
	h1.textContent = 'Temperature and Fan Control';

	const temperatureValues = document.createElement('div');
	temperatureValues.classList.add('temperature-values');

	const temp1Div = document.createElement('div');
	temp1Div.textContent = 'Inverter: ';
	const temp1Span = document.createElement('span');
	temp1Span.id = 'temp1';
	temp1Span.textContent = '0';
	temp1Div.appendChild(temp1Span);
	temp1Div.innerHTML += ' °C';

	const temp2Div = document.createElement('div');
	temp2Div.textContent = 'Environment: ';
	const temp2Span = document.createElement('span');
	temp2Span.id = 'temp2';
	temp2Span.textContent = '0';
	temp2Div.appendChild(temp2Span);
	temp2Div.innerHTML += ' °C';

	const fanSpeedDiv = document.createElement('div');
	fanSpeedDiv.textContent = 'Fan Speed: ';
	const fanSpeedSpan = document.createElement('span');
	fanSpeedSpan.id = 'fan-percent';
	fanSpeedSpan.textContent = '0';
	fanSpeedDiv.appendChild(fanSpeedSpan);
	fanSpeedDiv.innerHTML += '%';

	temperatureValues.appendChild(temp1Div);
	temperatureValues.appendChild(temp2Div);
	temperatureValues.appendChild(fanSpeedDiv);

	const chartContainer = document.createElement('div');
	chartContainer.classList.add('chart-container');

	// Chart wrapper for Temperature 1
	const temp1ChartWrapper = createChartWrapper('temp1Chart', 'temp1Label');

	// Chart wrapper for Temperature 2
	const temp2ChartWrapper = createChartWrapper('temp2Chart', 'temp2Label');

	// Chart wrapper for PWM
	const pwmChartWrapper = createChartWrapper('pwmChart', 'fanPercentLabel');

	chartContainer.appendChild(temp1ChartWrapper);
	chartContainer.appendChild(temp2ChartWrapper);
	chartContainer.appendChild(pwmChartWrapper);

	const form = document.createElement('form');
	form.id = 'control-form';

	const controlButtons = document.createElement('div');
	controlButtons.classList.add('control-buttons');

	const autoButton = document.createElement('button');
	autoButton.type = 'button';
	autoButton.id = 'auto-button';
	autoButton.textContent = 'Auto';

	const manualButton = document.createElement('button');
	manualButton.type = 'button';
	manualButton.id = 'manual-button';
	manualButton.textContent = 'Manual';

	controlButtons.appendChild(autoButton);
	controlButtons.appendChild(manualButton);

	const manualControls = document.createElement('div');
	manualControls.id = 'manual-controls';
	manualControls.style.display = 'none';

	const pwmLabel = document.createElement('label');
	pwmLabel.setAttribute('for', 'pwm-slider');
	pwmLabel.textContent = 'PWM: ';
	pwmLabel.innerHTML += '';

	const pwmSlider = document.createElement('input');
	pwmSlider.type = 'range';
	pwmSlider.id = 'pwm-slider';
	pwmSlider.min = '0';
	pwmSlider.max = '255';
	pwmSlider.value = _i.f;
	pwmSlider.name = 'pwm';

	manualControls.appendChild(pwmLabel);
	manualControls.appendChild(pwmSlider);

	const modeInput = document.createElement('input');
	modeInput.type = 'hidden';
	modeInput.name = 'mode';
	modeInput.id = 'mode';
	modeInput.value = 'auto';

	const submitButton = document.createElement('button');
	submitButton.type = 'submit';
	submitButton.textContent = 'Submit';

	form.appendChild(controlButtons);
	form.appendChild(manualControls);
	form.appendChild(modeInput);
	form.appendChild(submitButton);

	container.appendChild(h1);
	container.appendChild(temperatureValues);
	container.appendChild(chartContainer);
	container.appendChild(form);
	const chartButton = document.createElement('button');
	chartButton.textContent = 'Draw Chart';
	chartButton.addEventListener('click', function () {
		fetch('http://192.168.1.177:3000/json')
			.then(response => response.json())
			.then(data => {
				const labels = data.map(item => item.timestamp);
				const temp1Data = data.map(item => item.i);
				const temp2Data = data.map(item => item.e);
				const fanSpeedData = data.map(item => item.f);
				const modeData = data.map(item => item.a);
				const ctx = document.getElementById('lineChart').getContext('2d');
				const lineChart = new Chart(ctx, {
					type: 'line',
					data: {
						labels: labels,
						datasets: [
							{
								label: 'Inverter',
								data: temp1Data,
								borderColor: 'red',
								fill: false
							},
							{
								label: 'Environment',
								data: temp2Data,
								borderColor: 'blue',
								fill: false
							},
							{
								label: 'Fan Speed',
								data: fanSpeedData,
								borderColor: 'green',
								fill: false
							},
							{
								label: 'Mode',
								data: modeData,
								borderColor: 'orange',
								fill: false
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
							y: {
								display: true,
								title: {
									display: true,
									text: 'Value'
								}
							}
						}
					}
				});
			});
	});
	container.appendChild(chartButton);

	// Append container to body
	document.body.appendChild(container);

	// Event listeners
	autoButton.addEventListener('click', function () {
		manualControls.style.display = 'none';
		modeInput.value = 'auto';
		modeUpdate(1);
	});

	manualButton.addEventListener('click', function () {
		manualControls.style.display = 'block';
		modeInput.value = 'manual';
		modeUpdate(0);
	});

	pwmSlider.addEventListener('input', function () {
		updatePwmChart(pwmSlider.value);
	});

	autoButton.addEventListener('click', function () {
		manualControls.style.display = 'none';
		modeInput.value = 'auto';
	});

	manualButton.addEventListener('click', function () {
		manualControls.style.display = 'block';
		modeInput.value = 'manual';
	});

	pwmSlider.addEventListener('input', function () {
		pwmValue.innerText = pwmSlider.value;
		updatePwmChart(pwmSlider.value);
	});



	const temp1Ctx = document.getElementById('temp1Chart').getContext('2d');
	const temp2Ctx = document.getElementById('temp2Chart').getContext('2d');
	const pwmCtx = document.getElementById('pwmChart').getContext('2d');

	const temp1Chart = new Chart(temp1Ctx, {
		type: 'doughnut',
		data: {
			datasets: [{
				data: [25, 60],
				backgroundColor: ['#FF5733', '#e0e0e0'],
				borderWidth: 0
			}]
		},
		options: {
			rotation: -90,
			circumference: 180,
			cutout: '90%',
			plugins: {
				tooltip: { enabled: false },
				legend: { display: false }
			}
		}
	});

	const temp2Chart = new Chart(temp2Ctx, {
		type: 'doughnut',
		data: {
			datasets: [{
				data: [25, 40],
				backgroundColor: ['#33B5FF', '#e0e0e0'],
				borderWidth: 0
			}]
		},
		options: {
			rotation: -90,
			circumference: 180,
			cutout: '90%',
			plugins: {
				tooltip: { enabled: false },
				legend: { display: false }
			}
		}
	});

	const pwmChart = new Chart(pwmCtx, {
		type: 'doughnut',
		data: {
			datasets: [{
				data: [0, 255],
				backgroundColor: ['#4CAF50', '#e0e0e0'],
				borderWidth: 0
			}]
		},
		options: {
			rotation: -90,
			circumference: 180,
			cutout: '90%',
			plugins: {
				tooltip: { enabled: false },
				legend: { display: false }
			}
		}
	});

	document.getElementById('temp1').innerText = _i.i;
	document.getElementById('temp2').innerText = _i.e;
	document.getElementById('fan-percent').innerText = Math.round(_i.f / 255 * 10000) / 100;
	updateTemp1Chart(_i.i);
	updateTemp2Chart(_i.e);
	updatePwmChart(_i.f);

	const modeUpdate = (auto) => {
		if (auto) {
			autoButton.classList.add('highlight');
			autoButton.disabled = true;
			manualButton.disabled = false;
			manualButton.classList.remove('highlight');
			modeInput.value = 'auto';
		} else {
			manualButton.classList.add('highlight');
			manualButton.disabled = true;
			autoButton.classList.remove('highlight');
			autoButton.disabled = false;
			modeInput.value = 'manual';
		}
	}
	modeUpdate(_i.a == 1);
};

function getColorForTemp(value) {
	if (value < 30) {
		return 'skyblue';
	} else if (value > 45) {
		return 'red';
	} else {
		return 'orange';
	}
}

function getColorForPwm(value) {
	const red = Math.min(255, Math.floor(255 * value / 255));
	const green = Math.min(255, Math.floor(255 * (255 - value) / 255));
	return `rgb(${red},${green},0)`;
}

function updateTemp1Chart(value) {
	const color = getColorForTemp(value);
	temp1Chart.data.datasets[0].backgroundColor[0] = color;
	temp1Chart.data.datasets[0].data[0] = value;
	temp1Chart.data.datasets[0].data[1] = 60 - value;
	temp1Chart.update();
	temp1Label.innerText = `${value}°C`;
}

function updateTemp2Chart(value) {
	const color = getColorForTemp(value);
	temp2Chart.data.datasets[0].backgroundColor[0] = color;
	temp2Chart.data.datasets[0].data[0] = value;
	temp2Chart.data.datasets[0].data[1] = 40 - value;
	temp2Chart.update();
	temp2Label.innerText = `${value}°C`;
}

function updatePwmChart(value) {
	const color = getColorForPwm(value);
	pwmChart.data.datasets[0].backgroundColor[0] = color;
	pwmChart.data.datasets[0].data[0] = value;
	pwmChart.data.datasets[0].data[1] = 255 - value;
	pwmChart.update();
	fanPercentLabel.innerText = `${Math.round(value / 255 * 10000) / 100}%`;
}

function createChartWrapper(canvasId, labelId) {
	const wrapper = document.createElement('div');
	wrapper.classList.add('chart-wrapper');

	const canvas = document.createElement('canvas');
	canvas.id = canvasId;

	const label = document.createElement('div');
	label.classList.add('chart-label');
	label.id = labelId;
	label.textContent = '0';

	wrapper.appendChild(canvas);
	wrapper.appendChild(label);

	return wrapper;
}

setInterval(function () {
	fetch('http://192.168.1.50/json')
		.then(response => response.text())
		.then(d => {
			const data = d.parse(`${data.replace(/([a-z0-9]+):/g, '"$1": ')}`)

			const { i, e, f, a } = data;
			document.getElementById('temp1').innerText = i;
			document.getElementById('temp2').innerText = e;
			document.getElementById('fan-percent').innerText = Math.round(f / 255 * 10000) / 100;
			updateTemp1Chart(i);
			updateTemp2Chart(e);
			updatePwmChart(f);
			modeUpdate(a == 1);
		})
}, 5000);

document.addEventListener('DOMContentLoaded', main);

document.addEventListener('DOMContentLoaded', function () {
	// Create a <style> element
	const styleElement = document.createElement('style');
	document.head.appendChild(styleElement);

	// Define CSS rules as strings
	const css = `
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f0f0f0;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: white;
            padding: 20px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
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
            width: 100%;
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
		button.highlight {
			transform: translateY(1px); 
            box-shadow: 0 0 5px rgba(0, 0, 0, 0.3);
			background-color: white;
			border-color: green;
			color: green;
			padding-left: 30px;
		}
		button.highlight::before {
			content: "";
			background-color: transparent;
			position: absolute;
			left: 10px;
			top: 10px;
			width: 5px;
			border-bottom: 3px solid #4D7C2A;
			height: 11px;
			border-right: 3px solid #4D7C2A;
			transform: rotate(45deg);
			-o-transform: rotate(45deg);
			-ms-transform: rotate(45deg);
			-webkit-transform: rotate(45deg);
		}
		button {
			padding: 10px 20px;
            font-size: 16px;
            font-weight: bold;
            text-transform: uppercase;
            color: #ffffff;
            background-color: #007bff;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            transition: background-color 0.3s ease;}
    `;

	// Set the CSS text of the <style> element
	styleElement.appendChild(document.createTextNode(css));
});
