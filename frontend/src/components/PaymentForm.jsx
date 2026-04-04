function PaymentForm({ payment, onChange, totalAmount, onSubmit, submitting }) {
  const handleChange = (event) => {
    const { name, value } = event.target;
    onChange({ ...payment, [name]: value });
  };

  return (
    <section className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 3</p>
          <h3>Payment</h3>
        </div>
        <span className="price-tag">{totalAmount}</span>
      </div>

      <div className="form-grid">
        <select name="method" value={payment.method} onChange={handleChange}>
          <option value="Card">Credit / Debit Card</option>
          <option value="UPI">UPI</option>
          <option value="Net Banking">Net Banking</option>
        </select>
        <input
          name="cardName"
          placeholder="Cardholder / Payer name"
          value={payment.cardName}
          onChange={handleChange}
        />
        <input
          name="cardNumber"
          placeholder="Card or UPI number"
          value={payment.cardNumber}
          onChange={handleChange}
        />
        <input
          name="expiry"
          placeholder="Expiry / Validity"
          value={payment.expiry}
          onChange={handleChange}
        />
      </div>

      <button type="button" className="primary-button" onClick={onSubmit} disabled={submitting}>
        {submitting ? "Processing..." : "Confirm Booking"}
      </button>
    </section>
  );
}

export default PaymentForm;
