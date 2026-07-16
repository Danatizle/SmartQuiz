import os
import pymysql
from pymysql.cursors import DictCursor

# Carga las variables del archivo .env (solo en desarrollo local).
# En PythonAnywhere las variables se configuran en el archivo WSGI.
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv no está instalado; se asume que las variables
    # ya están en el entorno (p. ej. configuradas en el WSGI de PythonAnywhere).
    pass


def obtener_conexion():
    """
    Crea y retorna una conexión a la base de datos MySQL.
    Las credenciales se leen desde variables de entorno (archivo .env),
    NUNCA se escriben directamente en el código.
    Usa DictCursor para que los resultados sean diccionarios fáciles de usar.
    """
    try:
        conexion = pymysql.connect(
            host=os.environ.get('DB_HOST'),
            user=os.environ.get('DB_USER'),
            password=os.environ.get('DB_PASSWORD'),
            database=os.environ.get('DB_NAME'),
            charset='utf8mb4',
            cursorclass=DictCursor
        )
        return conexion
    except pymysql.MySQLError as e:
        # Si la conexión falla, imprime el error exacto en los logs del servidor.
        print(f"Error CRÍTICO al conectar con la base de datos: {e}")
        return None
