/**
 * @brief Implementation of statistical operations for web assembly.
 *
 * This program provides functions for statistical operations such as linear detrending,
 * auto-updating parameter ARMA model, setting parameters for ARMA model, autocorrelation function (ACF),
 * partial autocorrelation function (PACF), and Box-Cox transformation. It also includes memory
 * management functions for creating and destroying memory.
 *
 */
#include <emscripten.h>
#include <math.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdio.h>

/**
 * @brief Allocates memory of a specified size.
 *
 * @param size The size of the memory to allocate.
 * @return A pointer to the allocated memory.
 */
EMSCRIPTEN_KEEPALIVE
uint8_t* createMem(int size) {
	return malloc(size);
}

/**
 * @brief Deallocates the memory pointed to by the given pointer.
 *
 * @param p A pointer to the memory to be deallocated.
 */
EMSCRIPTEN_KEEPALIVE
void destroy(uint8_t* p){
	free(p);
}

/**
 * @brief Performs linear detrending on the input data.
 *
 * @param data The input data.
 * @param result The detrended data.
 * @param n The size of the data.
 */
EMSCRIPTEN_KEEPALIVE
void linear_detrend(float *data, float *result, int n) {
    float x_mean = 0.0;
    float y_mean = 0.0;
    float xy_cov = 0.0;
    float x_var = 0.0;

    // Calculate means and covariance
    for (int i = 0; i < n; i++) {
        x_mean += i;
        y_mean += data[i];
        xy_cov += i * data[i];
    }
    x_mean /= n;
    y_mean /= n;
    xy_cov /= n;

    // Calculate variance
    for (int i = 0; i < n; i++) {
        x_var += (i - x_mean) * (i - x_mean);
    }

    // Calculate slope and intercept
    float slope = (xy_cov - x_mean * y_mean) / x_var;
    float intercept = y_mean - slope * x_mean;

    // Detrend data
    for (int i = 0; i < n; i++) {
        result[i] = data[i] - (slope * i + intercept);
    }
}

/**
 * @brief Auto-updates parameters for the ARMA model.
 *
 * @param data The input data.
 * @param prediction The predicted data.
 * @param n The size of the data.
 */
EMSCRIPTEN_KEEPALIVE
// autoupdate parameter ARMA model
void arima_autoParams(float *data, float *prediction, int n) {
    int MAX_ITERATIONS = 1000;
    float TOLERANCE = 1e-6;
    float phi = 0.3; // AR coefficient
    float theta = -0.2; // MA coefficient
    float mu = 0.0; // Mean

    // Calculate the mean of the data
    for (int i = 0; i < n; i++) {
        mu += data[i];
    }
    mu /= n;

    for (int iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
        float prev_phi = phi;
        float prev_theta = theta;
        float prev_mu = mu;
        float sum_xy = 0.0;
        float sum_x_sq = 0.0;
        float sum_error_sq = 0.0;

        for (int i = 1; i < n; i++) {
            float error = data[i] - mu - phi * data[i-1] - theta * (data[i-1] - mu);
            sum_xy += data[i-1] * error;
            sum_x_sq += data[i-1] * data[i-1];
            sum_error_sq += error * error;
        }

        // Update phi and theta based on the relationships
        phi = sum_xy / sum_x_sq;
        theta = (sum_error_sq - phi * sum_xy) / (n - 1);

        // Check for convergence
        float diff_phi = phi - prev_phi;
        float diff_theta = theta - prev_theta;
        float diff_norm = sqrt(diff_phi * diff_phi + diff_theta * diff_theta);
        if (diff_norm < TOLERANCE) {
            printf("Converged after %d iterations\n", iteration + 1);
            break;
        }
    }

    // Generate predictions
    for (int i = 1; i < n; i++) {
        float error = data[i] - mu - phi * data[i-1] - theta * (data[i-1] - mu);
        prediction[i] = mu + phi * data[i-1] + theta * error;
    }
}

/**
 * @brief Sets parameters for the ARMA model.
 *
 * @param data The input data.
 * @param prediction The predicted data.
 * @param m The size of the data.
 */
EMSCRIPTEN_KEEPALIVE
// autoupdate parameter ARMA model
void arima_setParams(float *data, float *prediction, int m) {
	int n = m / sizeof(data[0]);
	int MAX_ITERATIONS = 1000;
	float TOLERANCE = 1e-6;
    // Initial guesses for model parameters
    float phi = 0.5; // AR coefficient
    float theta = 0.2; // MA coefficient
    float mu = 0.0; // Mean
	
	for (int j = 0; j < n; j++) {
        mu += data[j];
    }
	
	mu /= n;

    // Make predictions
    for (int i = 1; i < n; i++) {
        float error = data[i] - mu - phi * data[i-1] - theta * (data[i-1] - mu);
        prediction[i] = mu + phi * data[i-1] + theta * error;
    }
}

/**
 * @brief Computes the autocorrelation function (ACF) for the input data.
 *
 * @param data The input data.
 * @param result The computed ACF.
 * @param n The size of the data.
 */
EMSCRIPTEN_KEEPALIVE
// total autocorrelation function
void acf(float *data, float *result, int n) {
    int i, j;
    float mean = 0, var = 0;

    // Compute mean and variance of the data
    for (i = 0; i < n; i++) {
        mean += data[i];
    }
    mean /= n;
    for (i = 0; i < n; i++) {
        var += (data[i] - mean) * (data[i] - mean);
    }
    var /= n;

    // Compute autocorrelation function
    for (i = 0; i < n; i++) {
        float ac = 0;
        for (j = i; j < n; j++) {
            ac += (data[j] - mean) * (data[j - i] - mean);
        }
        result[i] = ac / ((n - i) * var);
    }
    
    // Adjust the first element of the result array
    result[0] /= 2;
}

/**
 * @brief Computes the partial autocorrelation function (PACF) for the input data.
 *
 * @param x The input data.
 * @param pacf_result The computed PACF.
 * @param n The size of the data.
 */
EMSCRIPTEN_KEEPALIVE
// partial autocorrelation function with max lag of 75
void pacf(float *x, float *pacf_result, int n) {
    int i, j, k;
    float r[n];
    float phi[n];
    float aic[n];

    for (i = 0; i < n; i++) {
        r[i] = x[i];
    }

    float min_aic = INFINITY;
    int max_lag = 0;

    for (k = 0; k < n; k++) {
        float num = 0.0;
        float den = 0.0;

        for (i = k; i < n; i++) {
            float y = r[i];

            for (j = 0; j < k; j++) {
                y -= phi[j] * r[i-j-1];
            }

            num += r[i-k-1] * y;
            den += y * y;
        }

        if (den == 0.0) {
            phi[k] = 0.0;
        } else {
            phi[k] = num / den;
        }

        pacf_result[k] = phi[k];

        for (j = 0; j < k; j++) {
            pacf_result[k] -= phi[j] * pacf_result[k-j-1];
        }

        int m = k + 1;
        float rss = 0.0;
        for (i = m; i < n; i++) {
            float y = r[i];
            for (j = 1; j <= m; j++) {
                y -= phi[j-1] * r[i-j];
            }
            rss += y * y;
        }
        float aic_val = log(rss/n) + 2.0 * (float)m / (float)n;
        aic[k] = aic_val;

        if (aic_val < min_aic) {
            min_aic = aic_val;
            max_lag = k;
        }
    }

    printf("Optimal maximum lag based on AIC: %d\n", max_lag);

    for (k = 0; k <= max_lag; k++) {
        float num = 0.0;
        float den = 0.0;

        for (i = k; i < n; i++) {
            float y = r[i];

            for (j = 0; j < k; j++) {
                y -= phi[j] * r[i-j-1];
            }

            num += r[i-k-1] * y;
            den += y * y;
        }

        if (den == 0.0) {
            phi[k] = 0.0;
        } else {
            phi[k] = num / den;
        }

        pacf_result[k] = phi[k];

        for (j = 0; j < k; j++) {
            pacf_result[k] -= phi[j] * pacf_result[k-j-1];
        }
    }
}

/**
 * @brief Applies the Box-Cox transformation on the input data.
 *
 * @param data The input data.
 * @param result The transformed data.
 * @param n The size of the data.
 */
EMSCRIPTEN_KEEPALIVE
void boxcox_transform(float* data, float* result, int n) {
	float lambda = 0.5;
    // Iterate over each data point
    for (int i = 0; i < n; i++) {
        if (lambda == 0) {
            // Handle case where lambda is zero (log transform)
            result[i] = log(data[i]);
        } else {
            // Compute Box-Cox transformation
            result[i] = (pow(data[i], lambda) - 1) / lambda;
        }
    }
}