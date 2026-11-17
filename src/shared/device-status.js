export function conexionESP(data) {
  const value = data?.conectado;
  return value === true || value === 1 ? true : value === false || value === 0 ? false : null;
}
