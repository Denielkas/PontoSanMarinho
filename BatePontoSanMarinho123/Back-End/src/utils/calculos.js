function horaParaMin(h) {
  if (!h || typeof h !== "string") return null;
  const [hh, mm] = h.split(":").map(Number);
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
  return hh * 60 + mm;
}

function minFromDateLocal(d) {
  if (!d || !(d instanceof Date) || isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function diffMinutos(inicio, fim) {
  if (inicio === null || fim === null) return 0;
  let diff = fim - inicio;
  if (diff < 0) diff += 1440;
  return diff;
}

function formatarSaldo(minutos) {
  const total = Number(minutos) || 0;
  const sinal = total < 0 ? "-" : "+";
  const absMin = Math.abs(total);
  const h = Math.floor(absMin / 60);
  const m = absMin % 60;
  return `${sinal}${h}h ${m}m`;
}

function formatarHora(d) {
  return d instanceof Date
    ? d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "--:--";
}

function calcularCargaHorariaRegra(regras = {}) {
  const rEntrada = horaParaMin(regras.entrada);
  const rIntInicio = horaParaMin(regras.intervalo_in);
  const rIntFim = horaParaMin(regras.intervalo_fi);
  const rSaida = horaParaMin(regras.saida);

  if (
    rEntrada === null ||
    rIntInicio === null ||
    rIntFim === null ||
    rSaida === null
  ) {
    return 0;
  }

  return diffMinutos(rEntrada, rIntInicio) + diffMinutos(rIntFim, rSaida);
}

function calcularDia({ pontos, regras, ehLinhaExtra = false, falta = false }) {
  const {
    entrada,
    intervalo_inicio,
    intervalo_fim,
    saida,
    intervalosExtras = [],
  } = pontos || {};

  const cargaPrevista = calcularCargaHorariaRegra(regras);

  if (falta) {
    return {
      entrada: "--:--",
      intervalo_inicio: "--:--",
      intervalo_fim: "--:--",
      saida: "--:--",
      total_horas: "0h 0m",
      saldo_bruto: -cargaPrevista,
    };
  }

  const mEntrada = minFromDateLocal(entrada);
  const mIntInicio = minFromDateLocal(intervalo_inicio);
  const mIntFim = minFromDateLocal(intervalo_fim);
  const mSaida = minFromDateLocal(saida);

  let trabalhado = 0;

  if (mEntrada !== null) {
    if (mIntInicio !== null) {
      trabalhado += diffMinutos(mEntrada, mIntInicio);

      if (mIntFim !== null && mSaida !== null) {
        trabalhado += diffMinutos(mIntFim, mSaida);
      }
    } else if (mSaida !== null) {
      trabalhado = diffMinutos(mEntrada, mSaida);
    }
  }

  if (!ehLinhaExtra && Array.isArray(intervalosExtras)) {
    for (const extra of intervalosExtras) {
      const ini = minFromDateLocal(extra?.inicio);
      const fim = minFromDateLocal(extra?.fim);

      if (ini !== null && fim !== null) {
        trabalhado -= diffMinutos(ini, fim);
      }
    }

    if (trabalhado < 0) trabalhado = 0;
  }

  let saldoDia = 0;

  if (ehLinhaExtra) {
    const temEntradaSaidaExtra = mEntrada !== null || mSaida !== null;
    saldoDia = temEntradaSaidaExtra ? trabalhado : 0;
  } else {
    if (trabalhado > 0) {
      saldoDia = trabalhado - cargaPrevista;
    }
  }

  return {
    entrada: formatarHora(entrada),
    intervalo_inicio: formatarHora(intervalo_inicio),
    intervalo_fim: formatarHora(intervalo_fim),
    saida: formatarHora(saida),
    total_horas:
      trabalhado > 0
        ? `${Math.floor(trabalhado / 60)}h ${trabalhado % 60}m`
        : "--",
    saldo_bruto: saldoDia,
  };
}

module.exports = {
  horaParaMin,
  minFromDateLocal,
  diffMinutos,
  formatarSaldo,
  formatarHora,
  calcularCargaHorariaRegra,
  calcularDia,
};