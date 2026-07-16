from conexionBD import obtener_conexion

def obtener_estado_partida_y_grupos(pin):
    """
    Obtiene el estado de la partida (esperando, en_curso, finalizada)
    y la lista de todos los participantes con sus grupos.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # 1. Obtener la partida
            sql_partida = "SELECT id_partida, estado FROM Partida WHERE pin_acceso = %s"
            cursor.execute(sql_partida, (pin,))
            partida = cursor.fetchone()

            if not partida:
                # Si la partida no existe, devolvemos un estado 'finalizada' para que el JS saque al alumno
                return {'estado_partida': 'finalizada', 'grupos': {}, 'jugadores_sin_grupo': []}

            # 2. Si la partida existe, obtener los participantes y sus grupos
            sql_grupos = """
                SELECT nombre_usuario_partida, id_grupo 
                FROM Participante 
                WHERE id_partida = %s AND estado = 'Activo'
            """
            cursor.execute(sql_grupos, (partida['id_partida'],))
            participantes = cursor.fetchall()
            
            # 3. Organizar los datos para el frontend
            grupos = {}
            jugadores_sin_grupo = []
            
            for p in participantes:
                nombre = p['nombre_usuario_partida']
                id_grupo = p['id_grupo']
                
                if id_grupo is None:
                    jugadores_sin_grupo.append(nombre)
                else:
                    if id_grupo not in grupos:
                        grupos[id_grupo] = []
                    grupos[id_grupo].append(nombre)

            return {
                'estado_partida': partida['estado'],
                'grupos': grupos, # Ej: {1: ['Juan', 'Ana'], 2: ['Luis']}
                'jugadores_sin_grupo': jugadores_sin_grupo
            }
            
    except Exception as e:
        print(f"Error en obtener_estado_partida_y_grupos: {e}")
        return {'error': f'Error de servidor: {e}'}
    finally:
        if conexion:
            conexion.close()

def asignar_jugador_a_grupo(pin, nombre_jugador, id_grupo):
    """
    Asigna un jugador a un grupo específico (o a NULL para 'sin grupo')
    dentro de una partida activa.
    """
    conexion = None
    try:
        conexion = obtener_conexion()
        with conexion.cursor() as cursor:
            # 1. Obtener id_partida usando el PIN y asegurando que esté 'esperando'
            sql_partida = "SELECT id_partida FROM Partida WHERE pin_acceso = %s AND estado = 'esperando'"
            cursor.execute(sql_partida, (pin,))
            partida = cursor.fetchone()
            
            if not partida:
                return {'success': False, 'message': 'La partida no existe o ya ha comenzado.'}

            # 2. Actualizar el id_grupo del participante
            sql_update = """
                UPDATE Participante 
                SET id_grupo = %s 
                WHERE id_partida = %s AND nombre_usuario_partida = %s AND estado = 'Activo'
            """
            filas_afectadas = cursor.execute(sql_update, (id_grupo, partida['id_partida'], nombre_jugador))
            
            if filas_afectadas == 0:
                conexion.rollback()
                return {'success': False, 'message': 'No se encontró al jugador en la partida.'}
                
            conexion.commit()
            return {'success': True}
            
    except Exception as e:
        if conexion:
            conexion.rollback()
        print(f"Error en asignar_jugador_a_grupo: {e}")
        return {'success': False, 'message': f'Error de servidor: {e}'}
    finally:
        if conexion:
            conexion.close()