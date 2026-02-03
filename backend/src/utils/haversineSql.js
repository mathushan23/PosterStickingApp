function haversineMetersSQL() {
  return `
  (6371000 * acos(
    cos(radians(?)) * cos(radians(latitude)) *
    cos(radians(longitude) - radians(?)) +
    sin(radians(?)) * sin(radians(latitude))
  ))
  `;
}

module.exports = {
  haversineMetersSQL,
};
