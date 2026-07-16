from conexionBD import obtener_conexion

def obtener_participantes_por_pin(pin):
    """
    Busca una partida por su PIN y devuelve la lista de nombres de los participantes
    que están ACTIVOS.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # 1. Obtener el id_partida a partir del PIN
            sql_partida = "SELECT id_partida FROM Partida WHERE pin_acceso = %s AND estado = 'esperando'"
            cursor.execute(sql_partida, (pin,))
            partida = cursor.fetchone()

            if not partida:
                return [] # Si la partida no existe o ya empezó, no hay participantes

            # --- CORRECCIÓN ---
            # Ahora solo selecciona participantes que estén 'Activo'
            sql_participantes = """
                SELECT nombre_usuario_partida
                FROM Participante
                WHERE id_partida = %s AND estado = 'Activo'
            """
            cursor.execute(sql_participantes, (partida['id_partida'],))

            participantes = [p['nombre_usuario_partida'] for p in cursor.fetchall()]
            return participantes
    except Exception as e:
        print(f"Error en obtener_participantes_por_pin: {e}")
        return []
    finally:
        if conexion:
            conexion.close()

def iniciar_partida(pin):
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = "UPDATE Partida SET estado = 'en_curso' WHERE pin_acceso = %s"
            cursor.execute(sql, (pin,))
        conexion.commit()
        return True
    except Exception as e:
        print(f"Error en comenzar_partida: {e}")
        return False
    finally:
        conexion.close()


# ===============================================================
# --- AÑADE ESTA NUEVA FUNCIÓN A controladorSalaEsperaProfesor.py ---
# ===============================================================

def eliminar_participantes_de_partida(id_partida):
    """
    Elimina permanentemente a todos los participantes de una partida específica.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            sql = "DELETE FROM Participante WHERE id_partida = %s"
            cursor.execute(sql, (id_partida,))
        conexion.commit()
    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en eliminar_participantes_de_partida: {e}")
        raise e # Propaga el error para que app.py lo maneje
    finally:
        if conexion:
            conexion.close()

# --- FUNCIÓN NUEVA ---
def desactivar_participante(pin, nombre_jugador):
    """
    Pone a un participante como 'Inactivo' usando el PIN y su nombre.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # 1. Encontrar la partida activa
            sql_partida = "SELECT id_partida FROM Partida WHERE pin_acceso = %s AND estado = 'esperando'"
            cursor.execute(sql_partida, (pin,))
            partida = cursor.fetchone()

            if not partida:
                return False # La partida no existe o ya empezó

            # 2. Actualizar al participante
            sql_update = """
                UPDATE Participante
                SET estado = 'Inactivo'
                WHERE id_partida = %s AND nombre_usuario_partida = %s AND estado = 'Activo'
            """
            filas_afectadas = cursor.execute(sql_update, (partida['id_partida'], nombre_jugador))
            conexion.commit()
            return filas_afectadas > 0 # Devuelve True si se actualizó
    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en desactivar_participante: {e}")
        return False
    finally:
        if conexion:
            conexion.close()

def finalizar_partida(pin, id_profesor):
    """
    Cambia el estado de una partida a 'finalizada'.
    Verifica que el profesor sea el dueño antes de finalizarla.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # 1. Verificar que el profesor es dueño de esta partida
            sql_verificar = """
                SELECT p.id_partida
                FROM Partida p
                JOIN Cuestionario c ON p.id_cuestionario = c.id_cuestionario
                WHERE p.pin_acceso = %s AND c.id_profesor_creador = %s
            """
            cursor.execute(sql_verificar, (pin, id_profesor))
            partida = cursor.fetchone()

            if not partida:
                return False # No es el dueño o la partida no existe

            # 2. Si es el dueño, finalizarla
            sql_finalizar = "UPDATE Partida SET estado = 'finalizada' WHERE id_partida = %s"
            cursor.execute(sql_finalizar, (partida['id_partida'],))
            conexion.commit()
            return cursor.rowcount > 0 # Devuelve True si se actualizó

    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en finalizar_partida: {e}")
        return False
    finally:
        if conexion:
            conexion.close()