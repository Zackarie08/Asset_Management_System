// ✅ SAVE PURCHASE ORDER
function savePO() {
  const item = document.getElementById("po-f-item").value;
  const qty = document.getElementById("po-f-qty").value;
  const unit = document.getElementById("po-f-unit").value;
  const date = document.getElementById("po-f-date").value;
  const eta = document.getElementById("po-f-eta").value;
  const notes = document.getElementById("po-f-notes").value;

  fetch(`${API_URL}/api/po`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      item_id: null, // we connect later
      quantity: qty,
      order_date: date,
      expected_delivery_date: eta,
      remarks: notes,
      unit
    })
  })
  .then(() => {
    closeM("m-add-po");
    renderPO();
  });
}


// ✅ LOAD / DISPLAY PO
async function renderPO() {
  const res = await fetch(`${API_URL}/api/po`);
  const data = await res.json();

  const tbody = document.getElementById("po-tbody");
  tbody.innerHTML = "";

  data.forEach(po => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${po.purchase_order_id}</td>
      <td>${po.item_id || "-"}</td>
      <td>${po.quantity_ordered}</td>
      <td>${po.order_date || ""}</td>
      <td>${po.expected_delivery_date || ""}</td>
      <td>${po.status}</td>
    `;

    tbody.appendChild(tr);
  });
}