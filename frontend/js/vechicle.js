async function renderVehicles() {
  const res = await fetch(`${API_URL}/api/vehicle`);
  const data = await res.json();

  const tbody = document.getElementById("veh-tbody");
  tbody.innerHTML = "";

  data.forEach(v => {
    const tr = document.createElement("tr");

    tr.className = "tr-clickable";
    tr.innerHTML = `
      <td>${v.vehicle_name}</td>
      <td>${v.type}</td>
      <td>${v.plate_number}</td>
      <td>${v.odometer || 0} km</td>
      <td>${v.status}</td>
      <td>${v.purchase_date || '-'}</td>
      <td>${v.price || '-'}</td>
    `;

    tr.addEventListener("click", () => {
      openDP("vehicle", v.vehicle_id, tr);
    });

    tbody.appendChild(tr);
  });
}


fetch(`${API_URL}/api/vehicle-maintenance`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    vehicle_id: currentVehicleId,
    maintenance_date: date,
    service_type: type,
    maintenance_cost: cost,
    odometer: odo,
    remarks
  })
});