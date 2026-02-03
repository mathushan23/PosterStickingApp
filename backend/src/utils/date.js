function addMonths(date, months) {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);

  // handle month overflow
  if (d.getDate() < day) d.setDate(0);
  return d;
}

function toISODateTime(dt) {
  return new Date(dt).toISOString();
}

module.exports = { addMonths, toISODateTime };
