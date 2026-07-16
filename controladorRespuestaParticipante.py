from conexionBD import obtener_conexion

# ============================================================
# 1) REGISTRAR RESPUESTA PARTICIPANTE
# ============================================================
def registrar_respuesta_participante(id_participante, id_pregunta, id_respuesta_seleccionada, tiempo_respuesta_segundos, puntuacion_obtenida):
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = """
                INSERT INTO RespuestaParticipante
                (id_participante, id_pregunta, id_respuesta_seleccionada, tiempo_respuesta_segundos, puntuacion_obtenida)
                VALUES (%s, %s, %s, %s, %s)
            """
            cursor.execute(sql, (id_participante, id_pregunta, id_respuesta_seleccionada, tiempo_respuesta_segundos, puntuacion_obtenida))
            conexion.commit()
            return cursor.lastrowid
    finally:
        conexion.close()


# ============================================================
# 2) ACTUALIZAR RESPUESTA PARTICIPANTE
# ============================================================
def actualizar_respuesta_participante(id_respuesta_participante, id_respuesta_seleccionada, tiempo_respuesta_segundos, puntuacion_obtenida):
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = """
                UPDATE RespuestaParticipante
                SET id_respuesta_seleccionada=%s,
                    tiempo_respuesta_segundos=%s,
                    puntuacion_obtenida=%s
                WHERE id_respuesta_participante=%s
            """
            cursor.execute(sql, (id_respuesta_seleccionada, tiempo_respuesta_segundos, puntuacion_obtenida, id_respuesta_participante))
            conexion.commit()
            return cursor.rowcount
    finally:
        conexion.close()


# ============================================================
# 3) OBTENER RESPUESTA POR ID
# ============================================================
def obtener_respuesta_participante_por_id(id_respuesta_participante):
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = """
                SELECT *
                FROM RespuestaParticipante
                WHERE id_respuesta_participante=%s
            """
            cursor.execute(sql, (id_respuesta_participante,))
            return cursor.fetchone()
    finally:
        conexion.close()


# ============================================================
# 4) OBTENER TODAS
# ============================================================
def obtener_respuestas_participante():
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            cursor.execute("SELECT * FROM RespuestaParticipante")
            return cursor.fetchall()
    finally:
        conexion.close()


# ============================================================
# 5) ELIMINAR RESPUESTA
# ============================================================
def eliminar_respuesta_participante(id_respuesta_participante):
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            cursor.execute("DELETE FROM RespuestaParticipante WHERE id_respuesta_participante=%s", (id_respuesta_participante,))
            conexion.commit()
            return cursor.rowcount
    finally:
        conexion.close()
