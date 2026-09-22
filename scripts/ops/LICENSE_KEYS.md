# QNT-0044 · Generador de claves de licencia (mismo algoritmo que LicenseGuard.mqh)

Clave del cliente = `SHA256(secreto + "|" + numero_de_cuenta_MT5)` en minusculas.

## Uso

```powershell
# 1. Fija el MISMO secreto que pusiste en LicenseGuard.mqh antes de compilar.
$env:QNT_LICENSE_SECRET = "TU_SECRETO_DE_COMPILACION"

# 2. Genera la clave para el numero de cuenta MT5 real del cliente.
bun run scripts/ops/generate-license-key.ts 12345678
```

Salida: la clave que debes entregar al cliente (la pega en `InpLicenseKey`).

## Reglas

- El secreto vive SOLO en tu entorno de compilacion y en este comando.
  Nunca en Git, nunca en la web, nunca en el .ex5 en claro (va dentro del
  binario compilado, que es lo maximo alcanzable sin un servidor de validacion).
- Una clave por numero de cuenta: si el cliente cambia de cuenta, se le genera
  otra clave (y puedes decidir no darla).
- Version futura (QNT-0045, opcional): validacion online contra
  `/api/licenses/validate` para poder revocar licencias a distancia.
