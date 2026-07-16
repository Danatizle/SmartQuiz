// static/js/unirse.js

let currentPin = '';
let gameId = null;
let playerId = null;
let playerName = '';

document.addEventListener('DOMContentLoaded', function() {
    const pinInput = document.getElementById('pinInput');
    const nombreInput = document.getElementById('nombreInput');

    document.getElementById('btnVerificarPin').addEventListener('click', verificarPin);
    document.getElementById('btnUnirse').addEventListener('click', unirseAlJuego);

    if (pinInput) {
        pinInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                verificarPin();
            }
        });

        pinInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/\s/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
            if (value.length > 6) value = value.substring(0, 6);
            e.target.value = value;
        });
    }

    if (nombreInput) {
        nombreInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                unirseAlJuego();
            }
        });
    }

    // Si llega desde QR
    const urlParams = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get('pin');
    if (pinFromUrl) pinInput.value = pinFromUrl;
});

async function verificarPin() {
    const pinInput = document.getElementById('pinInput');
    const pinError = document.getElementById('pinError');
    const btnVerificar = document.getElementById('btnVerificarPin');
    const pin = pinInput.value.trim();

    if (pin.length < 6) {
        pinInput.classList.add('error');
        pinError.textContent = 'El PIN debe tener al menos 6 caracteres.';
        pinError.classList.add('show');
        return;
    }

    btnVerificar.disabled = true;
    btnVerificar.textContent = 'Verificando...';
    pinInput.classList.remove('error');
    pinError.classList.remove('show');

    try {
        const response = await fetch('/api/game/verify-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pin })
        });
        const data = await response.json();

        if (data.success) {
            currentPin = pin;
            gameId = data.gameId;
            document.getElementById('stepPin').classList.add('hidden');
            document.getElementById('stepNombre').classList.remove('hidden');
            setTimeout(() => document.getElementById('nombreInput').focus(), 100);
        } else {
            pinInput.classList.add('error');
            pinError.textContent = data.message || 'PIN inválido o juego no disponible.';
            pinError.classList.add('show');
        }
    } catch (error) {
        console.error('Error al verificar PIN:', error);
        pinError.textContent = 'Error de red. Intenta nuevamente.';
        pinError.classList.add('show');
    } finally {
        btnVerificar.disabled = false;
        btnVerificar.textContent = 'Continuar';
    }
}

async function unirseAlJuego() {
    const nombreInput = document.getElementById('nombreInput');
    const nombreError = document.getElementById('nombreError');
    const btnUnirse = document.getElementById('btnUnirse');

    playerName = nombreInput.value.trim();

    if (playerName.length < 2) {
        nombreInput.classList.add('error');
        nombreError.textContent = 'El nombre debe tener al menos 2 caracteres.';
        nombreError.classList.add('show');
        return;
    }

    btnUnirse.disabled = true;
    btnUnirse.textContent = 'Uniéndose...';
    nombreInput.classList.remove('error');
    nombreError.classList.remove('show');

    try {
        const response = await fetch('/api/game/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pin: currentPin,
                playerName
            })
        });

        const data = await response.json();

        if (data.success) {
            playerId = data.playerId;
            gameId = data.gameId;

            console.log(`🎯 Unido correctamente. Redirigiendo a sala de espera del alumno`);

            // ✅ Redirige a sala de espera
            window.location.href = `/sala_espera_alumno?pin=${encodeURIComponent(currentPin)}&nickname=${encodeURIComponent(playerName)}`;
        } else {
            nombreInput.classList.add('error');
            nombreError.textContent = data.message || 'No se pudo unir al juego.';
            nombreError.classList.add('show');
        }
    } catch (error) {
        console.error('Error al unirse:', error);
        nombreError.textContent = 'Error de conexión. Intenta nuevamente.';
        nombreError.classList.add('show');
    } finally {
        btnUnirse.disabled = false;
        btnUnirse.textContent = 'Unirse al juego';
    }
}

function volverAPaso1() {
    document.getElementById('stepNombre').classList.add('hidden');
    document.getElementById('stepPin').classList.remove('hidden');
    document.getElementById('nombreInput').value = '';
}
