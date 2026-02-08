import os
import socket
import subprocess
import sys

def check_port(port):
    print(f"🔍 Verificando puerto {port} en 0.0.0.0...")
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("0.0.0.0", port))
            print(f"🟢 [OK] El puerto {port} está libre para ser usado.")
        except socket.error as e:
            print(f"🔴 [ERROR] El puerto {port} ya está en uso o bloqueado: {e}")
            print("💡 Sugerencia: Asegúrate de que no haya otra instancia del simulador corriendo.")

def check_vpn():
    print("🔍 Buscando interfaces de Red/VPN...")
    try:
        output = subprocess.check_output("ipconfig", shell=True).decode('latin-1')
        if "VPN" in output or "10.8." in output or "192.168." in output:
            print("🟢 [OK] Se detectó actividad de red/VPN.")
        else:
            print("⚠️ [AVISO] No se detectó una interfaz clara de VPN. Asegúrate de estar conectado.")
    except Exception as e:
        print(f"❌ Error al consultar ipconfig: {e}")

def check_firewall(port):
    print(f"🔍 Verificando Firewall de Windows para el puerto {port}...")
    try:
        cmd = f'netsh advfirewall firewall show rule name=all | findstr "{port}"'
        output = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if str(port) in output.stdout:
            print(f"🟢 [OK] Se encontró una regla de firewall mencionando el puerto {port}.")
        else:
            print(f"🔴 [ERROR] No se encontró una regla de entrada para el puerto {port}.")
            print(f"💡 Solución: Ejecuta en PowerShell (como Admin):")
            print(f'   New-NetFirewallRule -DisplayName "RPK Simulator {port}" -Direction Inbound -LocalPort {port} -Protocol TCP -Action Allow')
    except Exception as e:
        print(f"❌ Error al verificar firewall: {e}")

def main():
    print("\n==========================================")
    print("🛡️  RPK NETWORK AUDIT - DIAGNÓSTICO V2")
    print("==========================================\n")
    
    check_port(5000)
    print("")
    check_vpn()
    print("")
    check_firewall(5000)
    
    print("\n------------------------------------------")
    print("Si todos los checks son 🟢, deberías poder acceder")
    print("vía VPN usando http://[IP-DEL-TRABAJO]:5000")
    print("------------------------------------------")

if __name__ == "__main__":
    main()
