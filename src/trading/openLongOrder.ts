// src/trading/openLongOrder.ts
import { BinanceClient } from '../binance/client';
import { OrderSide, OrderType } from './orderManager';

/**
 * Parameters for opening a long position
 */
export interface OpenLongOrderParams {
    symbol: string;
    quantity: number;
    positionSide?: 'LONG';
    timestamp?: number;
}

/**
 * Response from opening a long position
 */
export interface OpenLongOrderResponse {
    orderId: number;
    symbol: string;
    status: string;
    clientOrderId: string;
    price: string;
    avgPrice: string;
    origQty: string;
    executedQty: string;
    cumQuote: string;
    timeInForce: string;
    type: string;
    reduceOnly: boolean;
    closePosition: boolean;
    side: string;
    positionSide: string;
    stopPrice: string;
    workingType: string;
    origType: string;
    updateTime: number;
    transactTime: number;
}

/**
 * Class for handling long position orders
 */
export class OpenLongOrder {
    private binanceClient: BinanceClient;

    constructor(binanceClient: BinanceClient) {
        this.binanceClient = binanceClient;
    }

    /**
     * Round quantity to the allowed precision for the symbol
     * @param quantity The quantity to round
     * @param symbol The trading pair symbol
     * @returns Rounded quantity
     */
    private roundQuantity(quantity: number, symbol: string): number {
        // Different symbols have different precision requirements
        // For most major pairs like BTCUSDT, 3 decimal places are sufficient
        // For smaller altcoins, you might need fewer decimal places
        if (symbol.includes('BTC')) {
            return Math.round(quantity * 1000) / 1000; // 3 decimal places
        } else if (symbol.includes('ETH')) {
            return Math.round(quantity * 100) / 100; // 2 decimal places
        } else {
            return Math.round(quantity * 10) / 10; // 1 decimal place for most altcoins
        }
    }

    /**
     * Open a long position with market order
     * @param params Parameters for opening a long position
     * @returns Order response
     */
    async execute(params: OpenLongOrderParams): Promise<OpenLongOrderResponse> {
        console.log(`📈 Opening long position for ${params.symbol}...`);
        
        // Ensure we have a timestamp
        const timestamp = params.timestamp || Date.now();
        
        // Round quantity to appropriate precision
        const roundedQuantity = this.roundQuantity(params.quantity, params.symbol);
        
        // Build request parameters
        const requestParams: Record<string, any> = {
            symbol: params.symbol,
            side: OrderSide.BUY,
            type: OrderType.MARKET,
            quantity: roundedQuantity.toString(), // Convert to string after rounding
            positionSide: params.positionSide || 'LONG',
            timestamp: timestamp,
            recvWindow: 5000
        };

        try {
            console.log(`📝 Creating market order for ${params.symbol} with params:`, requestParams);
            
            // Use the binance client's sendSignedRequest method
            const response = await this.binanceClient.sendSignedRequest('POST', '/fapi/v1/order', requestParams);
            
            console.log(`✅ Long position opened successfully. Order ID: ${response.orderId}`);
            
            return {
                orderId: response.orderId,
                symbol: response.symbol,
                status: response.status,
                clientOrderId: response.clientOrderId,
                price: response.price,
                avgPrice: response.avgPrice,
                origQty: response.origQty,
                executedQty: response.executedQty,
                cumQuote: response.cumQuote,
                timeInForce: response.timeInForce,
                type: response.type,
                reduceOnly: response.reduceOnly,
                closePosition: response.closePosition,
                side: response.side,
                positionSide: response.positionSide,
                stopPrice: response.stopPrice,
                workingType: response.workingType,
                origType: response.origType,
                updateTime: response.updateTime,
                transactTime: response.transactTime
            };
        } catch (error) {
            console.error(`❌ Failed to open long position for ${params.symbol}:`, error);
            throw error;
        }
    }
}