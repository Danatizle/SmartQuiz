document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('upload-form');
    const submitButton = document.getElementById('btn-submit-excel');
    const btnText = submitButton.querySelector('.btn-text');
    const btnLoader = submitButton.querySelector('.loader');
    const fileInput = document.getElementById('file');
    const fileStatus = document.getElementById('file-status');
    const fileStatusText = document.querySelector('.file-status-text');
    const progressFill = document.querySelector('.progress-fill');
    const fileLabelText = document.getElementById('file-label-text');

    // Detectar selección de archivo
    if (fileInput) {
        fileInput.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                const nombreArchivo = this.files[0].name;
                fileLabelText.textContent = nombreArchivo.length > 30
                    ? nombreArchivo.slice(0, 27) + "..."
                    : nombreArchivo;

                // Mostrar animación
                fileStatus.classList.remove('hidden', 'success');
                fileStatusText.textContent = "Cargando archivo...";
                progressFill.style.width = "0%";

                // Animación de barra de carga
                let progress = 0;
                const interval = setInterval(() => {
                    progress += Math.random() * 20; // avance aleatorio
                    if (progress >= 100) {
                        progress = 100;
                        clearInterval(interval);
                        fileStatus.classList.add('success');
                        fileStatusText.textContent = "Archivo cargado correctamente";
                    }
                    progressFill.style.width = progress + "%";
                }, 200);
            } else {
                fileStatus.classList.add('hidden');
                fileLabelText.textContent = "Seleccionar archivo";
            }
        });
    }

    // Mostrar loader al enviar el formulario
    if (uploadForm) {
        uploadForm.addEventListener('submit', function() {
            submitButton.disabled = true;
            if (btnText) btnText.classList.add('hidden');
            if (btnLoader) btnLoader.classList.remove('hidden');
        });
    }
});
