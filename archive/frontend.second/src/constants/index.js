const constants = {
  bannerOffset: 35,
  defaultOrgId: '00000000-0000-0000-0000-000000000000',
  headerHeight: 72,
  passwordPattern:
    '^(?=.*?[A-Za-z])(?=.*?[0-9])(?=.*?[{}()\\[\\].!~@#$%^&*<>+_,:?-]).{8,50}$',
  paymentAmtThreshold: 100,
  maxMemoLength: 10,
  invoiceAmtThreshold: 200, // making it $2 to ensure a profit is made on invoices after fees
};

export default constants;
