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
      <td>${v.status}</td>
      <td>${v.purchase_date || '-'}</td>
    `;

    tr.addEventListener("click", () => {
      openDP("vehicle", v.vehicle_id, tr);
    });

    tbody.appendChild(tr);
  });
}
``