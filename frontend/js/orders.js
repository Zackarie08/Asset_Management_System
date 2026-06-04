let currentOrderItemId = null; // make sure this exists globally

function savePO() {
  const qty   = parseInt(document.getElementById("po-f-qty").value) || 1;
  const unit  = document.getElementById("po-f-unit").value;
  const date  = document.getElementById("po-f-date").value;
  const eta   = document.getElementById("po-f-eta").value;
  const notes = document.getElementById("po-f-notes").value;

  fetch(`${API_URL}/api/po`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      item_id: currentOrderItemId, 
      quantity: qty,
      order_date: date,
      expected_delivery_date: eta,
      remarks: notes,
      unit,

      user_id: currentUser.user_id,
      performed_by: document.getElementById("po-f-performed").value || currentUser.name
    })
  })
  .then(() => {
    closeM("m-add-po");
    renderPO();
    renderInventory(); 
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