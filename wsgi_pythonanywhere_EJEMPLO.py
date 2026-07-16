# ============================================================
# EJEMPLO de archivo WSGI para PythonAnywhere
# ------------------------------------------------------------
# NO subas este archivo a producción tal cual. Su contenido va
# COPIADO dentro del archivo WSGI que PythonAnywhere genera en:
#   Web > (tu app) > WSGI configuration file
# Reemplaza "TU_USUARIO" por tu usuario de PythonAnywhere.
# ============================================================

import sys
import os

# 1. Ruta al proyecto (ajusta TU_USUARIO)
project_home = '/home/TU_USUARIO/SmartQuiz'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# 2. Variables de entorno (aquí van las credenciales, NO en el código)
os.environ['DB_HOST']       = 'TU_USUARIO.mysql.pythonanywhere-services.com'
os.environ['DB_USER']       = 'TU_USUARIO'
os.environ['DB_PASSWORD']   = 'tu_contraseña_de_bd'
os.environ['DB_NAME']       = 'TU_USUARIO$dawb_smartquiz'
os.environ['SECRET_KEY']    = 'pega_aqui_una_clave_aleatoria_larga'
os.environ['MAIL_USERNAME'] = 'tu_correo@gmail.com'
os.environ['MAIL_PASSWORD'] = 'tu_contraseña_de_aplicacion_gmail'

# 3. Importar la app de Flask
from app import app as application
