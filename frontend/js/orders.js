let currentOrderItemId = null; // make sure this exists globally


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