package com.pantriful.backend.inventory;

import java.util.List;

// Shape Claude's structured output is constrained to (see ReceiptParsingService).
public record ParsedReceipt(List<ParsedLineItem> items) {}
