"""
AutoRent Pro - Backend API (Flask + MySQL)
Servidor de API RESTful conectado a MySQL Server en VirtualBox (Ubuntu)
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from database import get_db_connection, serialize_item
from config import SERVER_HOST, SERVER_PORT, DEBUG_MODE
from werkzeug.security import generate_password_hash, check_password_hash
import traceback
import os
import threading
import webbrowser

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))

app = Flask(__name__)
# Habilitar CORS para permitir peticiones desde cualquier origen (frontend)
CORS(app)

@app.after_request
def add_no_cache_headers(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    return response



# ==============================================================================
# FRONTEND (servido por Flask: todo se ejecuta con `python app.py`)
# ==============================================================================
@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:filename>")
def serve_frontend(filename):
    return send_from_directory(FRONTEND_DIR, filename)


# ==============================================================================
# HEALTH CHECK & CONEXIÓN
# ==============================================================================
@app.route("/api/health", methods=["GET"])
def health_check():
    """Verifica el estado de la conexión con el servidor MySQL en VirtualBox."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT @@version AS mysql_version, DATABASE() AS current_db;")
        info = cursor.fetchone()
        cursor.close()
        conn.close()
        return jsonify({
            "status": "online",
            "message": "Conectado exitosamente a MySQL Server en VirtualBox",
            "database": info["current_db"],
            "version": info["mysql_version"]
        }), 200
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error conectando a MySQL: {str(e)}"
        }), 500


# ==============================================================================
# AUTENTICACIÓN Y CONTROL DE ACCESO (TABLA: usuario)
# ==============================================================================
@app.route("/api/auth/login", methods=["POST"])
def auth_login():
    """Valida credenciales de acceso contra la tabla `usuario` enlazada con `empleado`."""
    data = request.get_json() or {}
    usuario_input = (data.get("usuario") or "").strip()
    password_input = data.get("password") or ""

    if not usuario_input or not password_input:
        return jsonify({
            "status": "error",
            "message": "Debes ingresar tu usuario y contraseña"
        }), 400

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.id_usuario, u.id_empleado, u.usuario, u.password_hash, u.estado AS usuario_estado,
                   e.nombre, e.apellido, e.correo, e.cargo, e.telefono, e.estado AS empleado_estado
            FROM usuario u
            JOIN empleado e ON u.id_empleado = e.id_empleado
            WHERE LOWER(u.usuario) = LOWER(%s);
        """, (usuario_input,))
        user_row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not user_row:
            return jsonify({
                "status": "error",
                "message": "Usuario no encontrado o credenciales incorrectas"
            }), 401

        if str(user_row["usuario_estado"]).lower() != "activo":
            return jsonify({
                "status": "error",
                "message": "Esta cuenta de usuario se encuentra inactiva"
            }), 403

        # Verificación segura: acepta hash Werkzeug o coincidencia exacta (en caso de inserts manuales)
        pwd_hash = user_row["password_hash"]
        is_valid = False
        try:
            if check_password_hash(pwd_hash, password_input):
                is_valid = True
        except Exception:
            pass

        if not is_valid and (pwd_hash == password_input):
            is_valid = True

        if not is_valid:
            return jsonify({
                "status": "error",
                "message": "Contraseña incorrecta. Por favor verifica tus datos."
            }), 401

        # Restricción estricta de acceso: Solo Administradores
        cargo_empleado = (user_row["cargo"] or "").strip().lower()
        if "admin" not in cargo_empleado:
            return jsonify({
                "status": "error",
                "message": f"Acceso restringido: El usuario '{user_row['usuario']}' tiene cargo de '{user_row['cargo']}'. Únicamente los ADMINISTRADORES pueden ingresar al sistema."
            }), 403

        return jsonify({
            "status": "success",
            "message": f"¡Bienvenido(a), {user_row['nombre']} {user_row['apellido']}!",
            "user": {
                "id_usuario": user_row["id_usuario"],
                "id_empleado": user_row["id_empleado"],
                "usuario": user_row["usuario"],
                "nombre": user_row["nombre"],
                "apellido": user_row["apellido"],
                "nombre_completo": f"{user_row['nombre']} {user_row['apellido']}",
                "correo": user_row["correo"],
                "cargo": user_row["cargo"]
            }
        }), 200

    except Exception as e:
        return jsonify({
            "status": "error",
            "message": f"Error de autenticación en MySQL: {str(e)}"
        }), 500


# ==============================================================================
# PERFIL DE USUARIO (ADMINISTRADOR)
# ==============================================================================
@app.route("/api/auth/perfil/<int:id_usuario>", methods=["GET"])
def get_user_perfil(id_usuario):
    """Retorna los datos del perfil del usuario y su empleado asociado."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT u.id_usuario, u.id_empleado, u.usuario, u.estado AS usuario_estado,
                   e.nombre, e.apellido, e.correo, e.cargo, e.telefono, e.estado AS empleado_estado
            FROM usuario u
            JOIN empleado e ON u.id_empleado = e.id_empleado
            WHERE u.id_usuario = %s;
        """, (id_usuario,))
        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if not row:
            return jsonify({"error": "Usuario no encontrado"}), 404

        return jsonify(serialize_item(row)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/perfil/<int:id_usuario>", methods=["PUT"])
def update_user_perfil(id_usuario):
    """Actualiza la información personal y de acceso del usuario administrador."""
    try:
        data = request.json or {}
        nombre = data.get("nombre", "").strip()
        apellido = data.get("apellido", "").strip()
        correo = data.get("correo", "").strip()
        telefono = data.get("telefono", "").strip()
        usuario_val = data.get("usuario", "").strip()
        password_val = data.get("password")

        if not usuario_val:
            return jsonify({"error": "El nombre de usuario es obligatorio"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Obtener usuario actual
        cursor.execute("SELECT id_usuario, id_empleado, usuario FROM usuario WHERE id_usuario = %s;", (id_usuario,))
        user_row = cursor.fetchone()
        if not user_row:
            cursor.close()
            conn.close()
            return jsonify({"error": "Usuario no encontrado"}), 404

        id_empleado = user_row["id_empleado"]

        # 2. Verificar que el nuevo username no esté ocupado por otro usuario
        cursor.execute("SELECT id_usuario FROM usuario WHERE LOWER(usuario) = LOWER(%s) AND id_usuario != %s;", (usuario_val, id_usuario))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": f"El nombre de usuario '{usuario_val}' ya está en uso por otra cuenta."}), 400

        # 3. Actualizar datos en tabla empleado
        cursor.execute("""
            UPDATE empleado
            SET nombre = %s, apellido = %s, correo = %s, telefono = %s
            WHERE id_empleado = %s;
        """, (nombre, apellido, correo, telefono, id_empleado))

        # 4. Actualizar datos en tabla usuario (y contraseña si se especificó)
        if password_val and password_val.strip():
            new_hash = generate_password_hash(password_val.strip())
            cursor.execute("""
                UPDATE usuario
                SET usuario = %s, password_hash = %s
                WHERE id_usuario = %s;
            """, (usuario_val, new_hash, id_usuario))
        else:
            cursor.execute("""
                UPDATE usuario
                SET usuario = %s
                WHERE id_usuario = %s;
            """, (usuario_val, id_usuario))

        conn.commit()

        # 5. Obtener datos actualizados para responder
        cursor.execute("""
            SELECT u.id_usuario, u.id_empleado, u.usuario,
                   e.nombre, e.apellido, e.correo, e.cargo, e.telefono
            FROM usuario u
            JOIN empleado e ON u.id_empleado = e.id_empleado
            WHERE u.id_usuario = %s;
        """, (id_usuario,))
        updated_data = cursor.fetchone()

        cursor.close()
        conn.close()

        updated_user = {
            "id_usuario": updated_data["id_usuario"],
            "id_empleado": updated_data["id_empleado"],
            "usuario": updated_data["usuario"],
            "nombre": updated_data["nombre"],
            "apellido": updated_data["apellido"],
            "nombre_completo": f"{updated_data['nombre']} {updated_data['apellido']}".strip(),
            "correo": updated_data["correo"],
            "telefono": updated_data["telefono"],
            "cargo": updated_data["cargo"]
        }

        return jsonify({
            "message": "Perfil actualizado exitosamente",
            "user": updated_user
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# DASHBOARD STATS
# ==============================================================================
@app.route("/api/dashboard", methods=["GET"])
def get_dashboard_data():
    """Retorna los contadores y métricas agregadas en tiempo real de la base de datos."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Total flota y conteo por estados
        cursor.execute("""
            SELECT 
                COUNT(*) AS total_vehiculos,
                SUM(CASE WHEN LOWER(estado) = 'disponible' THEN 1 ELSE 0 END) AS disponibles,
                SUM(CASE WHEN LOWER(estado) = 'reservado' THEN 1 ELSE 0 END) AS reservados,
                SUM(CASE WHEN LOWER(estado) = 'alquilado' THEN 1 ELSE 0 END) AS alquilados,
                SUM(CASE WHEN LOWER(estado) LIKE '%mantenimiento%' THEN 1 ELSE 0 END) AS en_mantenimiento
            FROM vehiculo;
        """)
        stats_vehiculos = cursor.fetchone()

        # 2. Total Alquileres Activos
        cursor.execute("SELECT COUNT(*) AS total FROM alquiler WHERE LOWER(estado) = 'activo';")
        alq_activos = cursor.fetchone()["total"]

        # 3. Total Reservas y Desglose por Estados
        cursor.execute("""
            SELECT 
                COUNT(*) AS total_reservas,
                SUM(CASE WHEN LOWER(estado) = 'pendiente' THEN 1 ELSE 0 END) AS pendientes,
                SUM(CASE WHEN LOWER(estado) = 'confirmada' THEN 1 ELSE 0 END) AS confirmadas,
                SUM(CASE WHEN LOWER(estado) = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
                SUM(CASE WHEN LOWER(estado) = 'finalizada' THEN 1 ELSE 0 END) AS finalizadas,
                SUM(CASE WHEN LOWER(estado) = 'rechazada' THEN 1 ELSE 0 END) AS rechazadas
            FROM reserva;
        """)
        stats_reservas = cursor.fetchone()

        cursor.execute("SELECT estado, COUNT(*) AS total FROM reserva GROUP BY estado;")
        reservas_por_estado = {row["estado"]: row["total"] for row in cursor.fetchall()}

        # 4. Total Recaudado en Pagos
        cursor.execute("SELECT COALESCE(SUM(monto), 0) AS total_recaudo FROM pago;")
        total_recaudo = cursor.fetchone()["total_recaudo"]

        # 5. Mantenimientos en Proceso
        cursor.execute("SELECT COUNT(*) AS total FROM mantenimiento WHERE LOWER(estado) NOT IN ('completado', 'realizado', 'finalizado');")
        mant_pendientes = cursor.fetchone()["total"]

        # 6. Últimos 5 alquileres / entregas
        cursor.execute("""
            SELECT a.id_alquiler, a.fecha_inicio, a.km_inicio, a.km_fin, a.estado,
                   CONCAT(c.nombre, ' ', c.apellido) AS cliente_nombre,
                   v.placa AS vehiculo_placa,
                   CONCAT(m.nombre, ' ', v.modelo) AS vehiculo_detalle
            FROM alquiler a
            LEFT JOIN cliente c ON a.id_cliente = c.id_cliente
            LEFT JOIN vehiculo v ON a.id_vehiculo = v.id_vehiculo
            LEFT JOIN marca m ON v.id_marca = m.id_marca
            ORDER BY a.id_alquiler DESC
            LIMIT 5;
        """)
        ultimos_alquileres = cursor.fetchall()

        # 7. Últimas 5 reservas
        cursor.execute("""
            SELECT r.id_reserva, r.fecha_reserva, r.fecha_inicio, r.estado,
                   CONCAT(c.nombre, ' ', c.apellido) AS cliente_nombre,
                   v.placa AS vehiculo_placa,
                   CONCAT(m.nombre, ' ', v.modelo) AS vehiculo_detalle
            FROM reserva r
            LEFT JOIN cliente c ON r.id_cliente = c.id_cliente
            LEFT JOIN vehiculo v ON r.id_vehiculo = v.id_vehiculo
            LEFT JOIN marca m ON v.id_marca = m.id_marca
            ORDER BY r.id_reserva DESC
            LIMIT 5;
        """)
        ultimas_reservas = cursor.fetchall()

        # 8. Conteo real de registros por tabla
        conteos = {}
        for tabla in ("vehiculo", "cliente", "empleado", "reserva", "alquiler",
                      "pago", "mantenimiento", "marca", "tipo_vehiculo", "metodo_pago"):
            cursor.execute(f"SELECT COUNT(*) AS total FROM `{tabla}`;")
            conteos[tabla] = cursor.fetchone()["total"]

        cursor.close()
        conn.close()

        return jsonify(serialize_item({
            "conteos": conteos,
            "kpis": {
                "total_vehiculos": stats_vehiculos["total_vehiculos"] or 0,
                "disponibles": stats_vehiculos["disponibles"] or 0,
                "reservados": stats_vehiculos["reservados"] or 0,
                "alquilados": stats_vehiculos["alquilados"] or 0,
                "en_mantenimiento": stats_vehiculos["en_mantenimiento"] or 0,
                "alquileres_activos": alq_activos or 0,
                "total_reservas": stats_reservas["total_reservas"] or 0,
                "reservas_activas": (stats_reservas["pendientes"] or 0) + (stats_reservas["confirmadas"] or 0),
                "reservas_pendientes": stats_reservas["pendientes"] or 0,
                "reservas_confirmadas": stats_reservas["confirmadas"] or 0,
                "reservas_canceladas": stats_reservas["canceladas"] or 0,
                "reservas_finalizadas": stats_reservas["finalizadas"] or 0,
                "reservas_rechazadas": stats_reservas["rechazadas"] or 0,
                "reservas_por_estado": reservas_por_estado,
                "total_recaudo": total_recaudo or 0,
                "mantenimientos_pendientes": mant_pendientes or 0
            },
            "ultimos_alquileres": ultimos_alquileres,
            "ultimas_reservas": ultimas_reservas
        })), 200

    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


def _get_vehiculo_year_col(cursor):
    """Detecta de forma segura el nombre exacto de la columna del año en la tabla vehiculo."""
    cursor.execute("SHOW COLUMNS FROM vehiculo;")
    cols = [c["Field"] for c in cursor.fetchall()]
    known_other = {
        "id_vehiculo", "id_marca", "id_tipo_vehiculo", "placa",
        "modelo", "color", "estado", "kilometraje"
    }
    for col in cols:
        if col.lower() not in known_other:
            return col
    for col in cols:
        low = col.lower()
        if low != "estado" and ("a" in low and "o" in low and len(low) <= 4):
            return col
    return "año"


# ==============================================================================
# CRUD: VEHÍCULOS
# ==============================================================================
@app.route("/api/vehiculos", methods=["GET"])
def get_vehiculos():
    """Lista vehículos con marca y tipo, con soporte para búsqueda y filtrado."""
    try:
        search = request.args.get("search", "").strip()
        estado = request.args.get("estado", "").strip()
        id_tipo = request.args.get("id_tipo", "").strip()
        limit = int(request.args.get("limit", 5000))

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT v.*,
                   m.nombre AS marca_nombre,
                   tv.nombre AS tipo_nombre,
                   (SELECT p.monto 
                    FROM pago p 
                    JOIN alquiler a ON p.id_alquiler = a.id_alquiler 
                    WHERE a.id_vehiculo = v.id_vehiculo AND LOWER(p.estado) = 'abono'
                    ORDER BY p.id_pago DESC LIMIT 1) AS monto_abono,
                   (SELECT p.id_pago 
                    FROM pago p 
                    JOIN alquiler a ON p.id_alquiler = a.id_alquiler 
                    WHERE a.id_vehiculo = v.id_vehiculo AND LOWER(p.estado) = 'abono'
                    ORDER BY p.id_pago DESC LIMIT 1) AS id_pago_abono
            FROM vehiculo v
            LEFT JOIN marca m ON v.id_marca = m.id_marca
            LEFT JOIN tipo_vehiculo tv ON v.id_tipo_vehiculo = tv.id_tipo_vehiculo
            WHERE 1=1
        """
        params = []

        if estado and estado != "ALL":
            query += " AND LOWER(v.estado) = LOWER(%s)"
            params.append(estado)
        if id_tipo and id_tipo != "ALL":
            query += " AND v.id_tipo_vehiculo = %s"
            params.append(id_tipo)
        if search:
            query += " AND (v.placa LIKE %s OR v.modelo LIKE %s OR m.nombre LIKE %s OR v.color LIKE %s)"
            wildcard = f"%{search}%"
            params.extend([wildcard, wildcard, wildcard, wildcard])

        query += " ORDER BY v.id_vehiculo ASC LIMIT %s"
        params.append(limit)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/vehiculos", methods=["POST"])
def create_vehiculo():
    """Registra un nuevo vehículo en la base de datos."""
    try:
        data = request.json or {}
        placa = data.get("placa", "").strip().upper()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Validar placa duplicada
        cursor.execute("SELECT id_vehiculo FROM vehiculo WHERE placa = %s;", (placa,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": f"La placa {placa} ya está registrada en la base de datos."}), 400

        # Manejar marca escrita por el usuario o enviada por ID
        id_marca = data.get("id_marca")
        marca_texto = data.get("marca") or data.get("marca_nombre")
        if marca_texto and isinstance(marca_texto, str) and marca_texto.strip():
            nombre_marca = marca_texto.strip().title()
            cursor.execute("SELECT id_marca FROM marca WHERE LOWER(nombre) = LOWER(%s) LIMIT 1;", (nombre_marca,))
            row_marca = cursor.fetchone()
            if row_marca:
                id_marca = row_marca["id_marca"]
            else:
                cursor.execute("INSERT INTO marca (nombre) VALUES (%s);", (nombre_marca,))
                id_marca = cursor.lastrowid
        elif not id_marca:
            cursor.close()
            conn.close()
            return jsonify({"error": "Debe especificar la marca del vehículo."}), 400

        # Obtener nombre real de la columna año
        col_year = _get_vehiculo_year_col(cursor)

        sql = f"""
            INSERT INTO vehiculo (id_marca, id_tipo_vehiculo, placa, modelo, `{col_year}`, color, estado, kilometraje)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
        """
        params = (
            id_marca,
            data.get("id_tipo_vehiculo"),
            placa,
            data.get("modelo", ""),
            data.get("año", data.get("anio", 2024)),
            data.get("color", "Blanco"),
            data.get("estado", "Disponible"),
            data.get("kilometraje", 0)
        )
        cursor.execute(sql, params)
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({"message": "Vehículo registrado exitosamente", "id_vehiculo": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/vehiculos/<int:id_vehiculo>", methods=["PUT"])
def update_vehiculo(id_vehiculo):
    """Actualiza los datos técnicos o estado de un vehículo."""
    try:
        data = request.json or {}
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Manejar marca escrita por el usuario o enviada por ID
        id_marca = data.get("id_marca")
        marca_texto = data.get("marca") or data.get("marca_nombre")
        if marca_texto and isinstance(marca_texto, str) and marca_texto.strip():
            nombre_marca = marca_texto.strip().title()
            cursor.execute("SELECT id_marca FROM marca WHERE LOWER(nombre) = LOWER(%s) LIMIT 1;", (nombre_marca,))
            row_marca = cursor.fetchone()
            if row_marca:
                id_marca = row_marca["id_marca"]
            else:
                cursor.execute("INSERT INTO marca (nombre) VALUES (%s);", (nombre_marca,))
                id_marca = cursor.lastrowid
        elif not id_marca:
            cursor.close()
            conn.close()
            return jsonify({"error": "Debe especificar la marca del vehículo."}), 400

        col_year = _get_vehiculo_year_col(cursor)

        sql = f"""
            UPDATE vehiculo
            SET id_marca = %s,
                id_tipo_vehiculo = %s,
                placa = %s,
                modelo = %s,
                `{col_year}` = %s,
                color = %s,
                estado = %s,
                kilometraje = %s
            WHERE id_vehiculo = %s;
        """
        params = (
            id_marca,
            data.get("id_tipo_vehiculo"),
            data.get("placa", "").strip().upper(),
            data.get("modelo", ""),
            data.get("año", data.get("anio", 2024)),
            data.get("color", ""),
            data.get("estado", "Disponible"),
            data.get("kilometraje", 0),
            id_vehiculo
        )
        cursor.execute(sql, params)
        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({"message": f"Vehículo #{id_vehiculo} actualizado correctamente"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/vehiculos/<int:id_vehiculo>", methods=["DELETE"])
def delete_vehiculo(id_vehiculo):
    """Elimina un vehículo y sus registros dependientes en una transacción limpia."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # 1. Eliminar pagos de alquileres asociados a este vehículo
        cursor.execute("""
            DELETE FROM pago 
            WHERE id_alquiler IN (SELECT id_alquiler FROM alquiler WHERE id_vehiculo = %s);
        """, (id_vehiculo,))

        # 2. Eliminar alquileres asociados
        cursor.execute("DELETE FROM alquiler WHERE id_vehiculo = %s;", (id_vehiculo,))

        # 3. Eliminar mantenimientos asociados
        cursor.execute("DELETE FROM mantenimiento WHERE id_vehiculo = %s;", (id_vehiculo,))

        # 4. Eliminar reservas asociadas
        cursor.execute("DELETE FROM reserva WHERE id_vehiculo = %s;", (id_vehiculo,))

        # 5. Eliminar el vehículo
        cursor.execute("DELETE FROM vehiculo WHERE id_vehiculo = %s;", (id_vehiculo,))

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Vehículo #{id_vehiculo} y sus registros asociados eliminados exitosamente"}), 200
    except Exception as e:
        return jsonify({"error": f"No se pudo eliminar el vehículo: {str(e)}"}), 400



# ==============================================================================
# CRUD: CLIENTES
# ==============================================================================
@app.route("/api/clientes", methods=["GET"])
def get_clientes():
    """Lista clientes con búsqueda y paginación rápida."""
    try:
        search = request.args.get("search", "").strip()
        limit = int(request.args.get("limit", 5000))

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if search:
            query = """
                SELECT * FROM cliente
                WHERE identificacion LIKE %s 
                   OR nombre LIKE %s 
                   OR apellido LIKE %s 
                   OR telefono LIKE %s 
                   OR correo LIKE %s
                ORDER BY id_cliente ASC LIMIT %s;
            """
            wildcard = f"%{search}%"
            cursor.execute(query, (wildcard, wildcard, wildcard, wildcard, wildcard, limit))
        else:
            cursor.execute("SELECT * FROM cliente ORDER BY id_cliente ASC LIMIT %s;", (limit,))

        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/clientes", methods=["POST"])
def create_cliente():
    """Registra un nuevo cliente validando unicidad de cédula y correo."""
    try:
        data = request.json or {}
        identificacion = data.get("identificacion", "").strip()
        correo = data.get("correo", "").strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Chequeo de duplicados
        cursor.execute("SELECT id_cliente FROM cliente WHERE identificacion = %s;", (identificacion,))
        if cursor.fetchone():
            cursor.close()
            conn.close()
            return jsonify({"error": f"La identificación {identificacion} ya está registrada."}), 400

        sql = """
            INSERT INTO cliente (identificacion, nombre, apellido, telefono, correo, direccion, fecha_registro)
            VALUES (%s, %s, %s, %s, %s, %s, NOW());
        """
        cursor.execute(sql, (
            identificacion,
            data.get("nombre", "").strip(),
            data.get("apellido", "").strip(),
            data.get("telefono", "").strip(),
            correo,
            data.get("direccion", "").strip()
        ))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({"message": "Cliente registrado exitosamente", "id_cliente": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/clientes/<int:id_cliente>", methods=["PUT"])
def update_cliente(id_cliente):
    """Actualiza datos del cliente."""
    try:
        data = request.json or {}
        conn = get_db_connection()
        cursor = conn.cursor()
        sql = """
            UPDATE cliente
            SET identificacion = %s,
                nombre = %s,
                apellido = %s,
                telefono = %s,
                correo = %s,
                direccion = %s
            WHERE id_cliente = %s;
        """
        cursor.execute(sql, (
            data.get("identificacion", "").strip(),
            data.get("nombre", "").strip(),
            data.get("apellido", "").strip(),
            data.get("telefono", "").strip(),
            data.get("correo", "").strip(),
            data.get("direccion", "").strip(),
            id_cliente
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Cliente #{id_cliente} actualizado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/clientes/<int:id_cliente>", methods=["DELETE"])
def delete_cliente(id_cliente):
    """Elimina un cliente junto con sus reservas, alquileres y pagos asociados."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM pago WHERE id_alquiler IN (SELECT id_alquiler FROM alquiler WHERE id_cliente = %s);", (id_cliente,))
        cursor.execute("DELETE FROM alquiler WHERE id_cliente = %s;", (id_cliente,))
        cursor.execute("DELETE FROM reserva WHERE id_cliente = %s;", (id_cliente,))
        cursor.execute("DELETE FROM cliente WHERE id_cliente = %s;", (id_cliente,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Cliente #{id_cliente} eliminado"}), 200
    except Exception as e:
        return jsonify({"error": f"Error al eliminar: {str(e)}"}), 400


# ==============================================================================
# CRUD: EMPLEADOS
# ==============================================================================
@app.route("/api/empleados", methods=["GET"])
def get_empleados():
    """Lista el personal de la empresa."""
    try:
        search = request.args.get("search", "").strip()
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        if search:
            query = """
                SELECT * FROM empleado
                WHERE nombre LIKE %s OR apellido LIKE %s OR cargo LIKE %s OR correo LIKE %s
                ORDER BY id_empleado ASC LIMIT 5000;
            """
            wildcard = f"%{search}%"
            cursor.execute(query, (wildcard, wildcard, wildcard, wildcard))
        else:
            cursor.execute("SELECT * FROM empleado ORDER BY id_empleado ASC LIMIT 5000;")

        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/empleados", methods=["POST"])
def create_empleado():
    """Registra nuevo empleado."""
    try:
        data = request.json or {}
        conn = get_db_connection()
        cursor = conn.cursor()
        sql = """
            INSERT INTO empleado (nombre, apellido, telefono, correo, cargo, fecha_ingreso, estado)
            VALUES (%s, %s, %s, %s, %s, CURDATE(), %s);
        """
        cursor.execute(sql, (
            data.get("nombre", "").strip(),
            data.get("apellido", "").strip(),
            data.get("telefono", "").strip(),
            data.get("correo", "").strip(),
            data.get("cargo", "Asesor"),
            data.get("estado", "Activo")
        ))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({"message": "Empleado guardado", "id_empleado": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/empleados/<int:id_empleado>", methods=["PUT"])
def update_empleado(id_empleado):
    """Actualiza los datos de un empleado."""
    try:
        data = request.json or {}
        conn = get_db_connection()
        cursor = conn.cursor()
        sql = """
            UPDATE empleado
            SET nombre = %s, apellido = %s, telefono = %s, correo = %s, cargo = %s, estado = %s
            WHERE id_empleado = %s;
        """
        cursor.execute(sql, (
            data.get("nombre", "").strip(),
            data.get("apellido", "").strip(),
            data.get("telefono", "").strip(),
            data.get("correo", "").strip(),
            data.get("cargo", "Asesor"),
            data.get("estado", "Activo"),
            id_empleado
        ))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Empleado #{id_empleado} actualizado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/empleados/<int:id_empleado>", methods=["DELETE"])
def delete_empleado(id_empleado):
    """Elimina un empleado junto con los alquileres/mantenimientos que gestionó."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM pago WHERE id_alquiler IN (SELECT id_alquiler FROM alquiler WHERE id_empleado = %s);", (id_empleado,))
        cursor.execute("DELETE FROM alquiler WHERE id_empleado = %s;", (id_empleado,))
        cursor.execute("DELETE FROM mantenimiento WHERE id_empleado = %s;", (id_empleado,))
        cursor.execute("DELETE FROM empleado WHERE id_empleado = %s;", (id_empleado,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Empleado #{id_empleado} eliminado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ==============================================================================
# CRUD: RESERVAS (Con Algoritmo de Antisolapamiento)
# ==============================================================================
@app.route("/api/reservas", methods=["GET"])
def get_reservas():
    """Lista las reservas con datos del cliente y vehículo."""
    try:
        search = request.args.get("search", "").strip()
        estado = request.args.get("estado", "").strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT r.*,
                   CONCAT(c.nombre, ' ', c.apellido) AS cliente_nombre,
                   c.identificacion AS cliente_identificacion,
                   v.placa AS vehiculo_placa,
                   CONCAT(m.nombre, ' ', v.modelo) AS vehiculo_detalle
            FROM reserva r
            LEFT JOIN cliente c ON r.id_cliente = c.id_cliente
            LEFT JOIN vehiculo v ON r.id_vehiculo = v.id_vehiculo
            LEFT JOIN marca m ON v.id_marca = m.id_marca
            WHERE 1=1
        """
        params = []
        if estado and estado != "ALL":
            query += " AND LOWER(r.estado) = LOWER(%s)"
            params.append(estado)
        if search:
            query += " AND (c.nombre LIKE %s OR c.apellido LIKE %s OR v.placa LIKE %s OR c.identificacion LIKE %s)"
            wildcard = f"%{search}%"
            params.extend([wildcard, wildcard, wildcard, wildcard])

        query += " ORDER BY r.id_reserva ASC LIMIT 5000;"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/reservas", methods=["POST"])
def create_reserva():
    """Registra una nueva reserva con validación antisolapamiento de fecha."""
    try:
        data = request.json or {}
        id_vehiculo = data.get("id_vehiculo")
        fecha_inicio = data.get("fecha_inicio")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Algoritmo antisolapamiento básico a nivel de base de datos
        # Comprobar si el vehículo ya tiene una reserva pendiente o activa en esa fecha
        cursor.execute("""
            SELECT id_reserva FROM reserva
            WHERE id_vehiculo = %s
              AND fecha_inicio = %s
              AND LOWER(estado) IN ('pendiente', 'confirmada');
        """, (id_vehiculo, fecha_inicio))
        conflicto = cursor.fetchone()

        if conflicto:
            cursor.close()
            conn.close()
            return jsonify({
                "error": f"Colisión detectada: El vehículo ya tiene una reserva activa para esa fecha (Reserva #{conflicto['id_reserva']})."
            }), 400

        sql = """
            INSERT INTO reserva (id_cliente, id_vehiculo, fecha_reserva, fecha_inicio, estado, observaciones)
            VALUES (%s, %s, NOW(), %s, %s, %s);
        """
        cursor.execute(sql, (
            data.get("id_cliente"),
            id_vehiculo,
            fecha_inicio,
            data.get("estado", "Pendiente"),
            data.get("observaciones", "")
        ))

        # Disparador: si se crea como confirmada, cambiar estado del vehículo a 'Reservado'
        if data.get("estado") == "Confirmada":
            cursor.execute("UPDATE vehiculo SET estado = 'Reservado' WHERE id_vehiculo = %s;", (id_vehiculo,))

        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({"message": "Reserva confirmada exitosamente", "id_reserva": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/reservas/<int:id_reserva>/estado", methods=["PUT"])
def update_estado_reserva(id_reserva):
    """Cambia el estado de una reserva (Pendiente/Confirmada/Cancelada) y sincroniza el vehículo."""
    try:
        data = request.json or {}
        nuevo = (data.get("estado") or "").strip().capitalize()
        estados_validos = ("Pendiente", "Confirmada", "Cancelada", "Finalizada", "Rechazada")
        if nuevo not in estados_validos:
            return jsonify({"error": f"Estado de reserva no válido. Permitidos: {', '.join(estados_validos)}"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_vehiculo, fecha_inicio, estado FROM reserva WHERE id_reserva = %s;", (id_reserva,))
        res = cursor.fetchone()
        if not res:
            cursor.close()
            conn.close()
            return jsonify({"error": f"La reserva #{id_reserva} no existe."}), 404

        if nuevo in ("Pendiente", "Confirmada"):
            cursor.execute("""
                SELECT id_reserva FROM reserva
                WHERE id_vehiculo = %s AND fecha_inicio = %s AND id_reserva <> %s
                  AND LOWER(estado) IN ('pendiente', 'confirmada');
            """, (res["id_vehiculo"], res["fecha_inicio"], id_reserva))
            conflicto = cursor.fetchone()
            if conflicto:
                cursor.close()
                conn.close()
                return jsonify({"error": f"Colisión detectada: el vehículo ya tiene la reserva activa #{conflicto['id_reserva']} para esa fecha."}), 400

        cursor.execute("UPDATE reserva SET estado = %s WHERE id_reserva = %s;", (nuevo, id_reserva))
        if nuevo == "Confirmada":
            cursor.execute("UPDATE vehiculo SET estado = 'Reservado' WHERE id_vehiculo = %s AND estado = 'Disponible';", (res["id_vehiculo"],))
        elif nuevo in ("Cancelada", "Finalizada", "Rechazada"):
            cursor.execute("""
                UPDATE vehiculo SET estado = 'Disponible'
                WHERE id_vehiculo = %s AND estado = 'Reservado'
                  AND NOT EXISTS (SELECT 1 FROM reserva WHERE id_vehiculo = %s AND LOWER(estado) = 'confirmada');
            """, (res["id_vehiculo"], res["id_vehiculo"]))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Reserva #{id_reserva} actualizada a {nuevo}"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/reservas/<int:id_reserva>", methods=["DELETE"])
def delete_reserva(id_reserva):
    """Elimina o cancela una reserva."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM reserva WHERE id_reserva = %s;", (id_reserva,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Reserva #{id_reserva} eliminada"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ==============================================================================
# CRUD: ALQUILERES & ENTREGAS (Autómata de Estados)
# ==============================================================================
@app.route("/api/alquileres", methods=["GET"])
def get_alquileres():
    """Lista contratos de alquiler con detalles de cliente, asesor y vehículo."""
    try:
        search = request.args.get("search", "").strip()
        estado = request.args.get("estado", "").strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT a.*,
                   CONCAT(c.nombre, ' ', c.apellido) AS cliente_nombre,
                   CONCAT(e.nombre, ' ', e.apellido) AS empleado_nombre,
                   v.placa AS vehiculo_placa,
                   CONCAT(m.nombre, ' ', v.modelo) AS vehiculo_detalle,
                   (
                       SELECT p.estado 
                       FROM pago p 
                       WHERE p.id_alquiler = a.id_alquiler 
                       ORDER BY FIELD(LOWER(p.estado), 'pendiente', 'abono', 'rechazado', 'completado') ASC, p.id_pago DESC 
                       LIMIT 1
                   ) AS pago_estado,
                   (
                       SELECT p.monto 
                       FROM pago p 
                       WHERE p.id_alquiler = a.id_alquiler 
                       ORDER BY FIELD(LOWER(p.estado), 'pendiente', 'abono', 'rechazado', 'completado') ASC, p.id_pago DESC 
                       LIMIT 1
                   ) AS pago_monto
            FROM alquiler a
            LEFT JOIN cliente c ON a.id_cliente = c.id_cliente
            LEFT JOIN empleado e ON a.id_empleado = e.id_empleado
            LEFT JOIN vehiculo v ON a.id_vehiculo = v.id_vehiculo
            LEFT JOIN marca m ON v.id_marca = m.id_marca
            WHERE 1=1
        """
        params = []
        if estado and estado != "ALL":
            query += " AND LOWER(a.estado) = LOWER(%s)"
            params.append(estado)
        if search:
            query += " AND (c.nombre LIKE %s OR v.placa LIKE %s OR a.id_alquiler LIKE %s)"
            wildcard = f"%{search}%"
            params.extend([wildcard, wildcard, wildcard])

        query += " ORDER BY a.id_alquiler ASC LIMIT 5000;"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/alquileres", methods=["POST"])
def create_alquiler():
    """
    Registra contrato de alquiler (Activo o Pendiente).
    - Si es Activo: El vehículo pasa automáticamente a 'Alquilado'.
    - Si es Pendiente: El vehículo permanece en su estado actual (Disponible/Reservado).
    """
    try:
        data = request.json or {}
        id_vehiculo = data.get("id_vehiculo")
        estado = (data.get("estado") or "Activo").strip()
        if estado.lower() not in ("activo", "pendiente"):
            estado = "Activo"
        else:
            estado = "Activo" if estado.lower() == "activo" else "Pendiente"

        conn = get_db_connection()
        cursor = conn.cursor()

        sql = """
            INSERT INTO alquiler (id_cliente, id_vehiculo, id_empleado, fecha_inicio, km_inicio, km_fin, estado, observaciones)
            VALUES (%s, %s, %s, %s, %s, NULL, %s, %s);
        """
        cursor.execute(sql, (
            data.get("id_cliente"),
            id_vehiculo,
            data.get("id_empleado"),
            data.get("fecha_inicio"),
            data.get("km_inicio", 0),
            estado,
            data.get("observaciones", "")
        ))

        # Trigger Autómata: Cambiar estado a Alquilado solo si inicia como Activo
        if estado == "Activo":
            cursor.execute("UPDATE vehiculo SET estado = 'Alquilado' WHERE id_vehiculo = %s;", (id_vehiculo,))

        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        msg = "Contrato de alquiler iniciado. Vehículo marcado como Alquilado." if estado == "Activo" else f"Contrato de alquiler #{new_id} registrado como Pendiente."
        return jsonify({
            "message": msg,
            "id_alquiler": new_id
        }), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/alquileres/<int:id_alquiler>/estado", methods=["PUT"])
def update_estado_alquiler(id_alquiler):
    """
    Cambia el estado de un contrato de alquiler (Activo / Pendiente / Finalizado / Cancelado)
    y sincroniza automáticamente el estado de la flota de vehículos:
    - 'Activo': Conmuta vehículo a 'Alquilado' (valida que no haya colisión activa).
    - 'Pendiente': Libera vehículo a 'Disponible' si no tiene otro contrato activo.
    - 'Cancelado': Libera vehículo a 'Disponible' si no tiene otro contrato activo.
    - 'Finalizado': Libera vehículo a 'Disponible' y opcionalmente actualiza kilometraje final.
    """
    try:
        data = request.json or {}
        nuevo_raw = (data.get("estado") or "").strip().lower()
        estados_map = {
            "activo": "Activo",
            "pendiente": "Pendiente",
            "finalizado": "Finalizado",
            "retorno": "Finalizado",
            "cancelado": "Cancelado"
        }
        nuevo = estados_map.get(nuevo_raw)
        if not nuevo:
            return jsonify({"error": "Estado no válido. Permitidos: Activo, Pendiente, Finalizado, Cancelado"}), 400

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_vehiculo, km_inicio, km_fin, estado, observaciones FROM alquiler WHERE id_alquiler = %s;", (id_alquiler,))
        alq = cursor.fetchone()
        if not alq:
            cursor.close()
            conn.close()
            return jsonify({"error": f"El contrato #{id_alquiler} no existe."}), 404

        id_vehiculo = alq["id_vehiculo"]
        km_fin = data.get("km_fin")
        obs_extra = data.get("observaciones", "").strip()

        if nuevo == "Activo":
            cursor.execute("""
                SELECT id_alquiler FROM alquiler
                WHERE id_vehiculo = %s AND id_alquiler <> %s AND LOWER(estado) = 'activo';
            """, (id_vehiculo, id_alquiler))
            otro_activo = cursor.fetchone()
            if otro_activo:
                cursor.close()
                conn.close()
                return jsonify({"error": f"Colisión: el vehículo ya está asignado al contrato activo #{otro_activo['id_alquiler']}."}), 400

            cursor.execute("UPDATE alquiler SET estado = 'Activo' WHERE id_alquiler = %s;", (id_alquiler,))
            cursor.execute("UPDATE vehiculo SET estado = 'Alquilado' WHERE id_vehiculo = %s;", (id_vehiculo,))

        elif nuevo == "Cancelado":
            cursor.execute("UPDATE alquiler SET estado = 'Cancelado' WHERE id_alquiler = %s;", (id_alquiler,))
            cursor.execute("""
                UPDATE vehiculo SET estado = 'Disponible'
                WHERE id_vehiculo = %s AND estado = 'Alquilado'
                  AND NOT EXISTS (SELECT 1 FROM alquiler WHERE id_vehiculo = %s AND id_alquiler <> %s AND LOWER(estado) = 'activo');
            """, (id_vehiculo, id_vehiculo, id_alquiler))

        elif nuevo == "Pendiente":
            cursor.execute("UPDATE alquiler SET estado = 'Pendiente' WHERE id_alquiler = %s;", (id_alquiler,))
            cursor.execute("""
                UPDATE vehiculo SET estado = 'Disponible'
                WHERE id_vehiculo = %s AND estado = 'Alquilado'
                  AND NOT EXISTS (SELECT 1 FROM alquiler WHERE id_vehiculo = %s AND id_alquiler <> %s AND LOWER(estado) = 'activo');
            """, (id_vehiculo, id_vehiculo, id_alquiler))

        elif nuevo == "Finalizado":
            if km_fin is not None:
                try:
                    km_fin = int(km_fin)
                except (ValueError, TypeError):
                    km_fin = alq["km_inicio"] or 0
                if km_fin < (alq["km_inicio"] or 0):
                    cursor.close()
                    conn.close()
                    return jsonify({"error": f"El kilometraje final ({km_fin}) no puede ser menor al de salida ({alq['km_inicio']})."}), 400

                obs = alq["observaciones"] or ""
                if obs_extra:
                    obs = (obs + " | " + obs_extra).strip()

                cursor.execute("""
                    UPDATE alquiler
                    SET estado = 'Finalizado', km_fin = %s, observaciones = %s
                    WHERE id_alquiler = %s;
                """, (km_fin, obs, id_alquiler))
                cursor.execute("""
                    UPDATE vehiculo
                    SET kilometraje = GREATEST(COALESCE(kilometraje, 0), %s),
                        estado = 'Disponible'
                    WHERE id_vehiculo = %s;
                """, (km_fin, id_vehiculo))
            else:
                cursor.execute("UPDATE alquiler SET estado = 'Finalizado' WHERE id_alquiler = %s;", (id_alquiler,))
                cursor.execute("""
                    UPDATE vehiculo SET estado = 'Disponible'
                    WHERE id_vehiculo = %s AND estado = 'Alquilado'
                      AND NOT EXISTS (SELECT 1 FROM alquiler WHERE id_vehiculo = %s AND id_alquiler <> %s AND LOWER(estado) = 'activo');
                """, (id_vehiculo, id_vehiculo, id_alquiler))

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({
            "message": f"Contrato #{id_alquiler} actualizado a '{nuevo}'. Flota de vehículos sincronizada.",
            "estado": nuevo
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/alquileres/<int:id_alquiler>/cerrar", methods=["POST"])
def cerrar_alquiler(id_alquiler):
    """
    Cierre de Alquiler y Retorno de Vehículo:
    - Actualiza `km_fin` y marca estado como 'Finalizado'.
    - Trigger Autómata: Actualiza el kilometraje del vehículo y conmuta su estado a 'Disponible'.
    """
    try:
        data = request.json or {}
        km_fin = data.get("km_fin")
        obs_cierre = data.get("observaciones", "")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id_vehiculo, km_inicio, observaciones FROM alquiler WHERE id_alquiler = %s;", (id_alquiler,))
        alq = cursor.fetchone()
        if not alq:
            cursor.close()
            conn.close()
            return jsonify({"error": "Contrato no encontrado"}), 404

        id_vehiculo = alq["id_vehiculo"]
        obs_acumulada = (alq["observaciones"] or "") + " | Cierre: " + obs_cierre

        # 1. Finalizar alquiler
        cursor.execute("""
            UPDATE alquiler
            SET km_fin = %s,
                estado = 'Finalizado',
                observaciones = %s
            WHERE id_alquiler = %s;
        """, (km_fin, obs_acumulada.strip(), id_alquiler))

        # 2. Trigger Autómata: Retornar vehículo a Disponible y actualizar odómetro
        cursor.execute("""
            UPDATE vehiculo
            SET kilometraje = GREATEST(COALESCE(kilometraje, 0), %s),
                estado = 'Disponible'
            WHERE id_vehiculo = %s;
        """, (km_fin, id_vehiculo))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "message": "Vehículo retornado satisfactoriamente. Autómata T-SQL: Estado restaurado a 'Disponible'."
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/alquileres/<int:id_alquiler>", methods=["DELETE"])
def delete_alquiler(id_alquiler):
    """Elimina un contrato y sus pagos; libera el vehículo si el contrato seguía activo."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_vehiculo, estado FROM alquiler WHERE id_alquiler = %s;", (id_alquiler,))
        alq = cursor.fetchone()
        cursor.execute("DELETE FROM pago WHERE id_alquiler = %s;", (id_alquiler,))
        cursor.execute("DELETE FROM alquiler WHERE id_alquiler = %s;", (id_alquiler,))
        if alq and (alq["estado"] or "").lower() == "activo":
            cursor.execute("UPDATE vehiculo SET estado = 'Disponible' WHERE id_vehiculo = %s AND estado = 'Alquilado';", (alq["id_vehiculo"],))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Contrato #{id_alquiler} eliminado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ==============================================================================
# CRUD: PAGOS Y CAJA
# ==============================================================================
@app.route("/api/pagos", methods=["GET"])
def get_pagos():
    """Lista pagos registrados con detalles de contrato y método."""
    try:
        search = request.args.get("search", "").strip()
        estado = request.args.get("estado", "").strip()
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT p.*,
                   mp.nombre AS metodo_nombre,
                   CONCAT(c.nombre, ' ', c.apellido) AS cliente_nombre,
                   v.placa AS vehiculo_placa
            FROM pago p
            LEFT JOIN metodo_pago mp ON p.id_metodo_pago = mp.id_metodo_pago
            LEFT JOIN alquiler a ON p.id_alquiler = a.id_alquiler
            LEFT JOIN cliente c ON a.id_cliente = c.id_cliente
            LEFT JOIN vehiculo v ON a.id_vehiculo = v.id_vehiculo
            WHERE 1=1
        """
        params = []
        if estado and estado != "ALL":
            query += " AND LOWER(p.estado) = LOWER(%s)"
            params.append(estado)
        if search:
            query += " AND (p.referencia LIKE %s OR c.nombre LIKE %s OR c.apellido LIKE %s OR v.placa LIKE %s OR CAST(p.id_alquiler AS CHAR) LIKE %s)"
            wildcard = f"%{search}%"
            params.extend([wildcard, wildcard, wildcard, wildcard, wildcard])

        query += " ORDER BY p.id_pago DESC LIMIT 5000;"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/pagos", methods=["POST"])
def create_pago():
    """Registra un nuevo comprobante de pago."""
    try:
        data = request.json or {}
        conn = get_db_connection()
        cursor = conn.cursor()

        estado_pago = data.get("estado", "Pagado")
        id_alquiler = data.get("id_alquiler")
        sql = """
            INSERT INTO pago (id_alquiler, id_metodo_pago, fecha_pago, monto, estado, referencia)
            VALUES (%s, %s, NOW(), %s, %s, %s);
        """
        cursor.execute(sql, (
            id_alquiler,
            data.get("id_metodo_pago"),
            data.get("monto", 0),
            estado_pago,
            data.get("referencia", "")
        ))

        # Disparador: Si el pago es Abono, el vehículo del contrato pasa a 'Reservado'
        if str(estado_pago).lower() == "abono" and id_alquiler:
            cursor.execute("""
                UPDATE vehiculo v
                JOIN alquiler a ON v.id_vehiculo = a.id_vehiculo
                SET v.estado = 'Reservado'
                WHERE a.id_alquiler = %s AND LOWER(v.estado) NOT LIKE '%mantenimiento%';
            """, (id_alquiler,))

        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({"message": "Pago registrado con éxito", "id_pago": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/pagos/<int:id_pago>", methods=["DELETE"])
def delete_pago(id_pago):
    """Elimina un pago."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM pago WHERE id_pago = %s;", (id_pago,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Pago #{id_pago} eliminado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ==============================================================================
# CRUD: MANTENIMIENTOS
# ==============================================================================
@app.route("/api/mantenimientos", methods=["GET"])
def get_mantenimientos():
    """Lista órdenes de mantenimiento con búsqueda y filtro por estado."""
    try:
        search = request.args.get("search", "").strip()
        estado = request.args.get("estado", "").strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        query = """
            SELECT m.*,
                   m.id_matenimiento AS id_mantenimiento,
                   CONCAT(e.nombre, ' ', e.apellido) AS empleado_nombre,
                   v.placa AS vehiculo_placa,
                   CONCAT(mar.nombre, ' ', v.modelo) AS vehiculo_detalle
            FROM mantenimiento m
            LEFT JOIN empleado e ON m.id_empleado = e.id_empleado
            LEFT JOIN vehiculo v ON m.id_vehiculo = v.id_vehiculo
            LEFT JOIN marca mar ON v.id_marca = mar.id_marca
            WHERE 1=1
        """
        params = []
        if estado and estado != "ALL":
            query += " AND LOWER(m.estado) = LOWER(%s)"
            params.append(estado)
        if search:
            query += " AND (v.placa LIKE %s OR mar.nombre LIKE %s OR v.modelo LIKE %s OR e.nombre LIKE %s OR e.apellido LIKE %s OR m.descripcion LIKE %s OR CAST(m.id_matenimiento AS CHAR) LIKE %s)"
            wildcard = f"%{search}%"
            params.extend([wildcard, wildcard, wildcard, wildcard, wildcard, wildcard, wildcard])

        query += " ORDER BY m.id_matenimiento ASC LIMIT 5000;"
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mantenimientos", methods=["POST"])
def create_mantenimiento():
    """Registra una orden de mantenimiento y actualiza el estado del vehículo."""
    try:
        data = request.json or {}
        id_vehiculo = data.get("id_vehiculo")
        estado_mant = data.get("estado", "En Proceso")

        conn = get_db_connection()
        cursor = conn.cursor()

        sql = """
            INSERT INTO mantenimiento (id_vehiculo, id_empleado, fecha_mantenimiento, descripcion, costo, estado)
            VALUES (%s, %s, %s, %s, %s, %s);
        """
        cursor.execute(sql, (
            id_vehiculo,
            data.get("id_empleado"),
            data.get("fecha_mantenimiento"),
            data.get("descripcion", ""),
            data.get("costo", 0),
            estado_mant
        ))

        # Disparador: Si está en proceso, poner vehículo en 'Mantenimiento'
        if estado_mant.lower() in ("en proceso", "pendiente"):
            cursor.execute("UPDATE vehiculo SET estado = 'Mantenimiento' WHERE id_vehiculo = %s;", (id_vehiculo,))
        elif estado_mant.lower() in ("realizado", "completado"):
            cursor.execute("UPDATE vehiculo SET estado = 'Disponible' WHERE id_vehiculo = %s AND estado = 'Mantenimiento';", (id_vehiculo,))

        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()

        return jsonify({"message": "Mantenimiento registrado", "id_mantenimiento": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mantenimientos/<int:id_mantenimiento>/completar", methods=["PUT", "POST"])
def completar_mantenimiento(id_mantenimiento):
    """
    Marca la orden de mantenimiento como 'Completado' y restaura el estado del vehículo a 'Disponible'.
    """
    try:
        data = request.json or {}
        costo_final = data.get("costo")
        obs = (data.get("descripcion") or data.get("observaciones") or "").strip()

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id_matenimiento, id_vehiculo, estado, descripcion, costo FROM mantenimiento WHERE id_matenimiento = %s;", (id_mantenimiento,))
        mant = cursor.fetchone()
        if not mant:
            cursor.close()
            conn.close()
            return jsonify({"error": "Orden de mantenimiento no encontrada"}), 404

        id_vehiculo = mant["id_vehiculo"]

        updates = ["estado = 'Completado'"]
        params = []
        if costo_final is not None:
            updates.append("costo = %s")
            params.append(costo_final)
        if obs:
            nueva_desc = (mant["descripcion"] or "") + (" | " if mant["descripcion"] else "") + f"Finalizado: {obs}"
            updates.append("descripcion = %s")
            params.append(nueva_desc)

        params.append(id_mantenimiento)
        cursor.execute(f"UPDATE mantenimiento SET {', '.join(updates)} WHERE id_matenimiento = %s;", tuple(params))

        # Restaurar estado del vehículo a 'Disponible' si estaba en mantenimiento
        if id_vehiculo:
            cursor.execute("""
                UPDATE vehiculo
                SET estado = 'Disponible'
                WHERE id_vehiculo = %s
                  AND (LOWER(estado) LIKE '%mantenimiento%');
            """, (id_vehiculo,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "message": f"Mantenimiento #{id_mantenimiento} marcado como Completado y vehículo liberado a Disponible",
            "id_mantenimiento": id_mantenimiento,
            "id_vehiculo": id_vehiculo
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mantenimientos/<int:id_mantenimiento>", methods=["PUT"])
def update_mantenimiento(id_mantenimiento):
    """Actualiza una orden de mantenimiento existente y sincroniza el estado del vehículo."""
    try:
        data = request.json or {}
        estado_mant = data.get("estado", "En proceso")
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute("SELECT id_matenimiento, id_vehiculo FROM mantenimiento WHERE id_matenimiento = %s;", (id_mantenimiento,))
        mant = cursor.fetchone()
        if not mant:
            cursor.close()
            conn.close()
            return jsonify({"error": "Orden de mantenimiento no encontrada"}), 404

        id_vehiculo = data.get("id_vehiculo") or mant["id_vehiculo"]

        cursor.execute("""
            UPDATE mantenimiento
            SET id_vehiculo = %s,
                id_empleado = %s,
                fecha_mantenimiento = %s,
                descripcion = %s,
                costo = %s,
                estado = %s
            WHERE id_matenimiento = %s;
        """, (
            id_vehiculo,
            data.get("id_empleado"),
            data.get("fecha_mantenimiento"),
            data.get("descripcion", ""),
            data.get("costo", 0),
            estado_mant,
            id_mantenimiento
        ))

        # Sincronizar estado del vehículo
        if estado_mant.lower() in ("en proceso", "pendiente"):
            cursor.execute("UPDATE vehiculo SET estado = 'Mantenimiento' WHERE id_vehiculo = %s;", (id_vehiculo,))
        elif estado_mant.lower() in ("realizado", "completado", "cancelado"):
            cursor.execute("UPDATE vehiculo SET estado = 'Disponible' WHERE id_vehiculo = %s AND (LOWER(estado) LIKE '%mantenimiento%');", (id_vehiculo,))

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Mantenimiento #{id_mantenimiento} actualizado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/mantenimientos/<int:id_mantenimiento>", methods=["DELETE"])
def delete_mantenimiento(id_mantenimiento):
    """Elimina una orden de mantenimiento y restaura el vehículo si no tiene otros mantenimientos activos."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT id_vehiculo FROM mantenimiento WHERE id_matenimiento = %s;", (id_mantenimiento,))
        mant = cursor.fetchone()
        id_vehiculo = mant["id_vehiculo"] if mant else None

        cursor.execute("DELETE FROM mantenimiento WHERE id_matenimiento = %s;", (id_mantenimiento,))

        # Si el vehículo estaba en mantenimiento, verificar si quedan otros pendientes
        if id_vehiculo:
            cursor.execute("SELECT COUNT(*) AS restantes FROM mantenimiento WHERE id_vehiculo = %s AND LOWER(estado) NOT IN ('completado', 'realizado', 'cancelado');", (id_vehiculo,))
            rest = cursor.fetchone()
            if rest and rest["restantes"] == 0:
                cursor.execute("UPDATE vehiculo SET estado = 'Disponible' WHERE id_vehiculo = %s AND (LOWER(estado) LIKE '%mantenimiento%');", (id_vehiculo,))

        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Mantenimiento #{id_mantenimiento} eliminado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ==============================================================================
# CRUD: CATÁLOGOS BASE (Marcas, Tipos de Vehículo, Métodos de Pago)
# ==============================================================================
@app.route("/api/marcas", methods=["GET"])
def get_marcas():
    """Retorna todas las marcas."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM marca ORDER BY nombre ASC LIMIT 5000;")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/marcas", methods=["POST"])
def create_marca():
    """Crea una nueva marca."""
    try:
        data = request.json or {}
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO marca (nombre) VALUES (%s);", (data.get("nombre", "").strip(),))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({"message": "Marca creada", "id_marca": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tipos_vehiculo", methods=["GET"])
def get_tipos_vehiculo():
    """Retorna todos los tipos de vehículo."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM tipo_vehiculo ORDER BY nombre ASC LIMIT 5000;")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/tipos_vehiculo", methods=["POST"])
def create_tipo_vehiculo():
    """Crea un nuevo tipo de vehículo."""
    try:
        data = request.json or {}
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO tipo_vehiculo (nombre, descripcion) VALUES (%s, %s);", (
            data.get("nombre", "").strip(),
            data.get("descripcion", "").strip()
        ))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({"message": "Tipo de vehículo creado", "id_tipo_vehiculo": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/metodos_pago", methods=["GET"])
def get_metodos_pago():
    """Retorna métodos de pago."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM metodo_pago ORDER BY id_metodo_pago ASC;")
        rows = cursor.fetchall()
        cursor.close()
        conn.close()
        return jsonify(serialize_item(rows)), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/metodos_pago", methods=["POST"])
def create_metodo_pago():
    """Crea método de pago."""
    try:
        data = request.json or {}
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO metodo_pago (nombre, descripcion) VALUES (%s, %s);", (
            data.get("nombre", "").strip(),
            data.get("descripcion", "").strip()
        ))
        conn.commit()
        new_id = cursor.lastrowid
        cursor.close()
        conn.close()
        return jsonify({"message": "Método de pago creado", "id_metodo_pago": new_id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# EDICIÓN (PUT) DE RESERVAS, ALQUILERES, PAGOS Y MANTENIMIENTOS
# ==============================================================================
def _run_write(sql, params, ok_message):
    """Ejecuta una escritura simple y devuelve la respuesta JSON estándar."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(sql, params)
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": ok_message}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/reservas/<int:id_reserva>", methods=["PUT"])
def update_reserva(id_reserva):
    """Edita cliente, vehículo, fecha, estado y observaciones de una reserva."""
    data = request.json or {}
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT id_reserva FROM reserva
            WHERE id_vehiculo = %s AND fecha_inicio = %s AND id_reserva <> %s
              AND LOWER(estado) IN ('pendiente', 'confirmada');
        """, (data.get("id_vehiculo"), data.get("fecha_inicio"), id_reserva))
        conflicto = cursor.fetchone()
        if conflicto and (data.get("estado") or "").lower() in ("pendiente", "confirmada"):
            cursor.close()
            conn.close()
            return jsonify({"error": f"Colisión detectada: el vehículo ya tiene la reserva activa #{conflicto['id_reserva']} para esa fecha."}), 400
        cursor.execute("""
            UPDATE reserva SET id_cliente = %s, id_vehiculo = %s, fecha_inicio = %s, estado = %s, observaciones = %s
            WHERE id_reserva = %s;
        """, (data.get("id_cliente"), data.get("id_vehiculo"), data.get("fecha_inicio"),
              data.get("estado", "Pendiente"), data.get("observaciones", ""), id_reserva))
        if data.get("estado") == "Confirmada":
            cursor.execute("UPDATE vehiculo SET estado = 'Reservado' WHERE id_vehiculo = %s AND estado = 'Disponible';", (data.get("id_vehiculo"),))
        elif data.get("estado") in ("Cancelada", "Finalizada", "Rechazada"):
            cursor.execute("""
                UPDATE vehiculo SET estado = 'Disponible'
                WHERE id_vehiculo = %s AND estado = 'Reservado'
                  AND NOT EXISTS (SELECT 1 FROM reserva WHERE id_vehiculo = %s AND LOWER(estado) = 'confirmada');
            """, (data.get("id_vehiculo"), data.get("id_vehiculo")))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"Reserva #{id_reserva} actualizada"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/alquileres/<int:id_alquiler>", methods=["PUT"])
def update_alquiler(id_alquiler):
    """Edita un contrato de alquiler (cliente, asesor, fechas, km, estado, observaciones)."""
    data = request.json or {}
    return _run_write("""
        UPDATE alquiler SET id_cliente = %s, id_vehiculo = %s, id_empleado = %s, fecha_inicio = %s,
               km_inicio = %s, estado = %s, observaciones = %s
        WHERE id_alquiler = %s;
    """, (data.get("id_cliente"), data.get("id_vehiculo"), data.get("id_empleado"), data.get("fecha_inicio"),
          data.get("km_inicio", 0), data.get("estado", "Activo"), data.get("observaciones", ""), id_alquiler),
        f"Contrato #{id_alquiler} actualizado")


@app.route("/api/pagos/<int:id_pago>", methods=["PUT"])
def update_pago(id_pago):
    """Edita un comprobante de pago."""
    data = request.json or {}
    return _run_write("""
        UPDATE pago SET id_alquiler = %s, id_metodo_pago = %s, monto = %s, estado = %s, referencia = %s
        WHERE id_pago = %s;
    """, (data.get("id_alquiler"), data.get("id_metodo_pago"), data.get("monto", 0),
          data.get("estado", "Completado"), data.get("referencia", ""), id_pago),
        f"Pago #{id_pago} actualizado")


@app.route("/api/pagos/<int:id_pago>/estado", methods=["PUT"])
def update_estado_pago(id_pago):
    """Actualiza rápidamente el estado (y opcionalmente monto o abono) de un pago y sincroniza el estado del vehículo."""
    try:
        data = request.json or {}
        nuevo_estado = data.get("estado", "Completado")
        nuevo_monto = data.get("monto")

        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # 1. Actualizar el pago
        if nuevo_monto is not None:
            cursor.execute("UPDATE pago SET estado = %s, monto = %s WHERE id_pago = %s;", (nuevo_estado, float(nuevo_monto), id_pago))
        else:
            cursor.execute("UPDATE pago SET estado = %s WHERE id_pago = %s;", (nuevo_estado, id_pago))

        # 2. Sincronizar vehículo del contrato:
        # Regla de negocio: Si el pago es un Abono, el vehículo queda 'Reservado'
        if nuevo_estado.lower() == "abono":
            cursor.execute("""
                UPDATE vehiculo v
                JOIN alquiler a ON v.id_vehiculo = a.id_vehiculo
                SET v.estado = 'Reservado'
                WHERE a.id_alquiler = (SELECT id_alquiler FROM pago WHERE id_pago = %s)
                  AND LOWER(v.estado) NOT LIKE '%mantenimiento%';
            """, (id_pago,))
        elif nuevo_estado.lower() in ("completado", "pagado"):
            cursor.execute("""
                UPDATE vehiculo v
                JOIN alquiler a ON v.id_vehiculo = a.id_vehiculo
                SET v.estado = CASE WHEN LOWER(a.estado) = 'activo' THEN 'Alquilado' ELSE 'Disponible' END
                WHERE a.id_alquiler = (SELECT id_alquiler FROM pago WHERE id_pago = %s)
                  AND v.estado = 'Reservado';
            """, (id_pago,))

        conn.commit()
        cursor.close()
        conn.close()

        return jsonify({
            "status": "success",
            "message": f"Estado del pago #{id_pago} actualizado a {nuevo_estado}"
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# EDICIÓN Y BORRADO DE CATÁLOGOS (con protección si están en uso)
# ==============================================================================
def _catalog_delete(table, pk, fk_table, id_value, label):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM `{fk_table}` WHERE `{pk}` = %s;", (id_value,))
        en_uso = cursor.fetchone()[0]
        if en_uso:
            cursor.close()
            conn.close()
            return jsonify({"error": f"No se puede eliminar: {label} está siendo usado por {en_uso} registro(s)."}), 400
        cursor.execute(f"DELETE FROM `{table}` WHERE `{pk}` = %s;", (id_value,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({"message": f"{label} eliminado"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


@app.route("/api/marcas/<int:id_marca>", methods=["PUT"])
def update_marca(id_marca):
    data = request.json or {}
    return _run_write("UPDATE marca SET nombre = %s WHERE id_marca = %s;", ((data.get("nombre") or "").strip(), id_marca), "Marca actualizada")


@app.route("/api/marcas/<int:id_marca>", methods=["DELETE"])
def delete_marca(id_marca):
    return _catalog_delete("marca", "id_marca", "vehiculo", id_marca, "La marca")


@app.route("/api/tipos_vehiculo/<int:id_tipo>", methods=["PUT"])
def update_tipo_vehiculo(id_tipo):
    data = request.json or {}
    return _run_write("UPDATE tipo_vehiculo SET nombre = %s, descripcion = %s WHERE id_tipo_vehiculo = %s;",
                      ((data.get("nombre") or "").strip(), (data.get("descripcion") or "").strip(), id_tipo), "Tipo actualizado")


@app.route("/api/tipos_vehiculo/<int:id_tipo>", methods=["DELETE"])
def delete_tipo_vehiculo(id_tipo):
    return _catalog_delete("tipo_vehiculo", "id_tipo_vehiculo", "vehiculo", id_tipo, "El tipo de vehículo")


@app.route("/api/metodos_pago/<int:id_metodo>", methods=["PUT"])
def update_metodo_pago(id_metodo):
    data = request.json or {}
    return _run_write("UPDATE metodo_pago SET nombre = %s, descripcion = %s WHERE id_metodo_pago = %s;",
                      ((data.get("nombre") or "").strip(), (data.get("descripcion") or "").strip(), id_metodo), "Método actualizado")


@app.route("/api/metodos_pago/<int:id_metodo>", methods=["DELETE"])
def delete_metodo_pago(id_metodo):
    return _catalog_delete("metodo_pago", "id_metodo_pago", "pago", id_metodo, "El método de pago")


# ==============================================================================
# MAIN ENTRY POINT
# ==============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print(" AutoRent Pro - Servidor API Flask")
    print(f" Conectado a MySQL Server en 192.168.56.101:3306")
    print(f" Base de Datos: alquiler_vehiculos")
    print(f" Servidor iniciado en http://localhost:{SERVER_PORT}")
    print("=" * 60)
    # Abrir el navegador automáticamente (solo en el proceso principal del reloader)
    if not DEBUG_MODE or os.environ.get("WERKZEUG_RUN_MAIN") == "true":
        threading.Timer(1.0, lambda: webbrowser.open(f"http://localhost:{SERVER_PORT}")).start()
    app.run(host=SERVER_HOST, port=SERVER_PORT, debug=DEBUG_MODE)
