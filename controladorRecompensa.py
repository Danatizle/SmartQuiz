import pymysql
from conexionBD import obtener_conexion
import logging

# Configuración del logger para seguimiento
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO) # Nivel de logging a INFO

# --- Funciones de Utilidad y Seguridad ---  controlador recompensa

def obtener_id_profesor_de_recompensa(id_recompensa):
    """Obtiene el ID del profesor dueño del cuestionario al que pertenece la recompensa."""
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = """
                SELECT c.id_profesor_creador
                FROM Recompensa r
                JOIN Cuestionario c ON r.id_cuestionario = c.id_cuestionario
                WHERE r.id_recompensa = %s
            """
            cursor.execute(sql, (id_recompensa,))
            resultado = cursor.fetchone()
            return resultado['id_profesor_creador'] if resultado else None
    except Exception as e:
        logger.error(f"Error en obtener_id_profesor_de_recompensa: {e}", exc_info=True)
        return None
    finally:
        if conexion:
            conexion.close()

def validar_propiedad_recompensa(id_recompensa, id_profesor):
    """Verifica que la recompensa exista y pertenezca al profesor."""
    profesor_dueno = obtener_id_profesor_de_recompensa(id_recompensa)
    return profesor_dueno == id_profesor


# -------------------------------------------------------------
## 📝 Funciones CRUD de Recompensa (Actualizadas con BD)
# -------------------------------------------------------------

def crear_recompensa(id_cuestionario, descripcion, condicion=None, url_imagen=None):
    """
    Registra una nueva recompensa con id_cuestionario, descripción, condición y url_imagen.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = "INSERT INTO Recompensa (id_cuestionario, descripcion, condicion, url_imagen) VALUES (%s, %s, %s, %s)"
            cursor.execute(sql, (id_cuestionario, descripcion, condicion, url_imagen))
            conexion.commit()
            return cursor.lastrowid
    except Exception as e:
        logger.error(f"Error en crear_recompensa: {e}", exc_info=True)
        if conexion: conexion.rollback()
        return None
    finally:
        if conexion: conexion.close()

def actualizar_recompensa(id_recompensa, nueva_descripcion, nueva_condicion=None, nueva_url_imagen=None):
    """
    Actualiza la descripción, condición y url_imagen de una recompensa existente.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = "UPDATE Recompensa SET descripcion = %s, condicion = %s, url_imagen = %s WHERE id_recompensa = %s"
            cursor.execute(sql, (nueva_descripcion, nueva_condicion, nueva_url_imagen, id_recompensa))
            conexion.commit()
            return cursor.rowcount
    except Exception as e:
        logger.error(f"Error en actualizar_recompensa: {e}", exc_info=True)
        if conexion: conexion.rollback()
        return 0
    finally:
        if conexion: conexion.close()

def obtener_recompensa_por_id_con_seguridad(id_recompensa, id_profesor):
    """
    Obtiene una recompensa específica por ID. Requiere el id_profesor para validar
    la propiedad a través de 'validar_propiedad_recompensa'.
    """
    conexion = None
    try:
        # La validación de la propiedad ocurre antes de la consulta
        if not validar_propiedad_recompensa(id_recompensa, id_profesor):
            logger.warning(f"Intento de acceso no autorizado a recompensa {id_recompensa} por profesor {id_profesor}")
            return None

        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = "SELECT id_recompensa, id_cuestionario, descripcion, condicion, url_imagen FROM Recompensa WHERE id_recompensa = %s"
            cursor.execute(sql, (id_recompensa,))
            return cursor.fetchone()
    except Exception as e:
        logger.error(f"Error en obtener_recompensa_por_id_con_seguridad: {e}", exc_info=True)
        return None
    finally:
        if conexion: conexion.close()

def obtener_recompensas_por_cuestionario(id_cuestionario):
    """
    Obtiene la lista de recompensas de un cuestionario.
    La validación de la propiedad del Cuestionario se realiza en la ruta de Flask.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = "SELECT id_recompensa, id_cuestionario, descripcion, condicion, url_imagen FROM Recompensa WHERE id_cuestionario = %s ORDER BY id_recompensa ASC"
            cursor.execute(sql, (id_cuestionario,))
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Error en obtener_recompensas_por_cuestionario: {e}", exc_info=True)
        return []
    finally:
        if conexion: conexion.close()

def eliminar_recompensa(id_recompensa):
    """
    Elimina permanentemente una recompensa por su ID.
    La validación de la propiedad se realiza en la ruta de Flask.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = "DELETE FROM Recompensa WHERE id_recompensa = %s"
            cursor.execute(sql, (id_recompensa,))
            conexion.commit()
            return cursor.rowcount
    except Exception as e:
        logger.error(f"Error en eliminar_recompensa: {e}", exc_info=True)
        if conexion: conexion.rollback()
        return 0
    finally:
        if conexion: conexion.close()