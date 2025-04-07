// Configuration
const GEMINI_API_KEY = 'AIzaSyBYE4hRDfskZ9bxY1avf972xnwQGIQuYaQ';
const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// DOM Elements
const searchInput = document.getElementById('speciesSearch');
const searchButton = document.getElementById('searchButton');
const searchResults = document.getElementById('searchResults');
const speciesChart = document.getElementById('speciesChart');

// Initialize Chart
let chart = new Chart(speciesChart, {
    type: 'bar',
    data: {
        labels: ['Endangered', 'Vulnerable', 'Near Threatened', 'Least Concern'],
        datasets: [{
            label: 'Species Status',
            data: [41000, 2610000, 1740000, 4350000],
            backgroundColor: [
                'rgba(231, 76, 60, 0.8)',
                'rgba(241, 196, 15, 0.8)',
                'rgba(52, 152, 219, 0.8)',
                'rgba(46, 204, 113, 0.8)'
            ],
            borderColor: [
                'rgba(231, 76, 60, 1)',
                'rgba(241, 196, 15, 1)',
                'rgba(52, 152, 219, 1)',
                'rgba(46, 204, 113, 1)'
            ],
            borderWidth: 1
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
            duration: 2000,
            easing: 'easeInOutQuart'
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: function(value) {
                        return value.toLocaleString();
                    }
                }
            }
        },
        plugins: {
            legend: {
                display: true,
                position: 'top'
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        return context.dataset.label + ': ' + context.raw.toLocaleString();
                    }
                }
            }
        }
    }
});

// Search species using Gemini AI
async function searchSpecies(query) {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
        throw new Error('API key not configured. Please contact the administrator.');
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Provide detailed information about the wildlife species: ${query}. Include:
                        1. Conservation status
                        2. Habitat
                        3. Key characteristics
                        4. Current threats
                        5. Conservation efforts`
                    }]
                }],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                },
                safetySettings: [
                    {
                        category: "HARM_CATEGORY_HARASSMENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_HATE_SPEECH",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    },
                    {
                        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                        threshold: "BLOCK_MEDIUM_AND_ABOVE"
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`API request failed: ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('Invalid API response format');
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error('Error searching species:', error);
        throw error;
    }
}

// Handle search with loading state and error handling
searchButton.addEventListener('click', async () => {
    const query = searchInput.value.trim();
    if (!query) {
        searchResults.innerHTML = '<p class="error">Please enter a species name</p>';
        return;
    }

    searchButton.disabled = true;
    searchButton.innerHTML = '<span class="loading"></span> Searching...';
    searchResults.innerHTML = '<p>Searching for species information...</p>';

    try {
        const result = await searchSpecies(query);
        
        // Clean up the response and format it into sections
        const cleanResult = result.replace(/\*\*/g, ''); // Remove markdown bold
        const sections = cleanResult.split('\n\n').filter(section => section.trim());
        
        const formattedSections = sections.map(section => {
            const [title, ...content] = section.split('\n');
            const cleanTitle = title.replace(/^[0-9]+\.\s*/, ''); // Remove numbering
            return `
                <div class="info-section">
                    <h4 class="section-title">${cleanTitle}</h4>
                    <div class="content">
                        ${content.map(line => {
                            const cleanLine = line.replace(/^-\s*/, ''); // Remove bullet points
                            return `<p class="info-line">${cleanLine}</p>`;
                        }).join('')}
                    </div>
                </div>
            `;
        }).join('');

        searchResults.innerHTML = `
            <div class="species-info">
                <h3 class="species-name">${query}</h3>
                <div class="species-details">
                    ${formattedSections}
                </div>
            </div>
        `;

        // Add animation classes after a small delay
        setTimeout(() => {
            document.querySelector('.species-info').classList.add('fade-in');
            document.querySelectorAll('.info-section').forEach((section, index) => {
                setTimeout(() => {
                    section.classList.add('slide-in');
                }, index * 200);
            });
        }, 100);
    } catch (error) {
        let errorMessage = 'Failed to fetch species information. ';
        if (error.message.includes('API key')) {
            errorMessage += 'API key is not configured. Please contact the administrator.';
        } else if (error.message.includes('401')) {
            errorMessage += 'Invalid API key. Please check your configuration.';
        } else {
            errorMessage += `Error: ${error.message}`;
        }
        
        searchResults.innerHTML = `
            <div class="error">
                <p>${errorMessage}</p>
                <p>Please try again later or contact support if the problem persists.</p>
            </div>
        `;
    } finally {
        searchButton.disabled = false;
        searchButton.textContent = 'Search';
    }
});

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Add smooth scroll for navigation
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});
