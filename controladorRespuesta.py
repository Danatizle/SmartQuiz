from conexionBD import obtener_conexion

# ==============================
#  CREAR RESPUESTA
# ==============================
def registrar_respuesta(id_pregunta, texto_respuesta, es_correcta):
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = """
                INSERT INTO Respuesta (id_pregunta, texto_respuesta, es_correcta)
                VALUES (%s, %s, %s)
            """
            cursor.execute(sql, (id_pregunta, texto_respuesta, es_correcta))
        conexion.commit()
        return cursor.lastrowid
    finally:
        if conexion:
            conexion.close()


# ==============================
#  ACTUALIZAR RESPUESTA
# ==============================
def actualizar_respuesta(id_respuesta, texto_respuesta, es_correcta):
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            sql = """
                UPDATE Respuesta
                SET texto_respuesta = %s, es_correcta = %s
                WHERE id_respuesta = %s
            """
            cursor.execute(sql, (texto_respuesta, es_correcta, id_respuesta))
        conexion.commit()
        return cursor.rowcount
    finally:
        if conexion:
            conexion.close()


# ==============================
#  OBTENER RESPUESTA POR ID
# ==============================
def obtener_respuesta_por_id(id_respuesta):
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            cursor.execute("""
                SELECT *
                FROM Respuesta
                WHERE id_respuesta = %s
            """, (id_respuesta,))
            return cursor.fetchone()
    finally:
        if conexion:
            conexion.close()


# ==============================
#  OBTENER TODAS
# ==============================
def obtener_respuestas():
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            cursor.execute("SELECT * FROM Respuesta")
            return cursor.fetchall()
    finally:
        if conexion:
            conexion.close()


# ==============================
#  ELIMINAR RESPUESTA
# ==============================
def eliminar_respuesta(id_respuesta):
    conexion = obtener_conexion()
    try:
        with conexion.cursor() as cursor:
            cursor.execute("DELETE FROM Respuesta WHERE id_respuesta = %s", (id_respuesta,))
        conexion.commit()
        return cursor.rowcount
    finally:
        if conexion:
            conexion.close()
