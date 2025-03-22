  document.addEventListener('DOMContentLoaded', () => {
            const usernamesInput = document.getElementById('usernamesInput');
            const resultsOutput = document.getElementById('resultsOutput');
            const fetchButton = document.getElementById('fetchButton');
            const copyButton = document.getElementById('copyButton');
            const copyUUIDsOnlyButton = document.getElementById('copyUUIDsOnlyButton');
            const clearInputButton = document.getElementById('clearInputButton');
            const clearResultsButton = document.getElementById('clearResultsButton');
            const statusMessage = document.getElementById('statusMessage');
            const progressBar = document.getElementById('progressBar');
            const progressFill = document.getElementById('progressFill');
            const progressText = document.getElementById('progressText');
            const copyNotification = document.getElementById('copyNotification');
            
            // Function to show copy notification
            function showCopyNotification() {
                copyNotification.style.display = 'block';
                setTimeout(() => {
                    copyNotification.style.display = 'none';
                }, 2000);
            }
            
            // Copy all UUIDs with names
            copyButton.addEventListener('click', () => {
                if (resultsOutput.value) {
                    navigator.clipboard.writeText(resultsOutput.value)
                        .then(() => {
                            showCopyNotification();
                        })
                        .catch(err => {
                            statusMessage.textContent = 'Failed to copy: ' + err;
                        });
                }
            });
            
            // Copy only the UUIDs without usernames
            copyUUIDsOnlyButton.addEventListener('click', () => {
                if (resultsOutput.value) {
                    const lines = resultsOutput.value.split('\n');
                    const uuidsOnly = lines.map(line => {
                        const match = line.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
                        return match ? match[1] : '';
                    }).filter(uuid => uuid !== '').join('\n');
                    
                    navigator.clipboard.writeText(uuidsOnly)
                        .then(() => {
                            showCopyNotification();
                        })
                        .catch(err => {
                            statusMessage.textContent = 'Failed to copy: ' + err;
                        });
                }
            });
            
            // Clear buttons
            clearInputButton.addEventListener('click', () => {
                usernamesInput.value = '';
            });
            
            clearResultsButton.addEventListener('click', () => {
                resultsOutput.value = '';
            });
            
            // Function to fetch a single UUID with parallelization
            async function fetchUUID(username) {
                try {
                    const response = await fetch(`https://playerdb.co/api/player/minecraft/${username}`);
                    const data = await response.json();
                    
                    // Check if the response was cached
                    const isCached = response.headers.get('x-worker-cache') === 'true';
                    
                    if (data.success) {
                        const uuid = data.data.player.id;
                        const formattedUuid = uuid.replace(/(\w{8})(\w{4})(\w{4})(\w{4})(\w{12})/, '$1-$2-$3-$4-$5');
                        
                        // Format with (cached) label if cached
                        const displayName = isCached ? `${username} <span class="cached-entry">(cached)</span>` : username;
                        return { 
                            success: true, 
                            result: `${displayName}: ${formattedUuid}`, 
                            username,
                            uuid: formattedUuid,
                            isCached
                        };
                    } else {
                        return { 
                            success: false, 
                            result: `${username}: Player not found`, 
                            username,
                            isCached
                        };
                    }
                } catch (error) {
                    return { 
                        success: false, 
                        result: `${username}: Error fetching UUID - ${error.message}`, 
                        username,
                        isCached: false
                    };
                }
            }
            
            fetchButton.addEventListener('click', async () => {
                // Clear previous results and status
                resultsOutput.value = '';
                statusMessage.textContent = '';
                statusMessage.classList.remove('cached');
                
                // Get usernames from input
                const usernames = usernamesInput.value.trim().split(/\n+/).filter(name => name.trim() !== '');
                
                if (usernames.length === 0) {
                    statusMessage.textContent = 'Please enter at least one username.';
                    return;
                }
                
                // Setup progress bar
                progressBar.style.display = 'block';
                progressFill.style.width = '0%';
                progressText.textContent = `0/${usernames.length}`;
                
                // Optimize fetching with concurrency
                const BATCH_SIZE = 5; // Fetch 5 usernames at a time
                let completed = 0;
                let hasCachedResponses = false;
                let resultLines = [];
                let tempResultsHTML = document.createElement('div');
                
                // Process in batches to improve speed while preventing rate limiting
                for (let i = 0; i < usernames.length; i += BATCH_SIZE) {
                    statusMessage.textContent = `Fetching batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(usernames.length/BATCH_SIZE)}...`;
                    
                    const batch = usernames.slice(i, i + BATCH_SIZE);
                    const promises = batch.map(username => fetchUUID(username.trim()));
                    
                    try {
                        const results = await Promise.all(promises);
                        
                        for (const result of results) {
                            if (result.isCached) {
                                hasCachedResponses = true;
                            }
                            
                            // Use HTML to highlight cached entries in the output
                            tempResultsHTML.innerHTML = result.result;
                            resultLines.push(tempResultsHTML.textContent);
                            
                            // Update progress
                            completed++;
                            const progress = (completed / usernames.length) * 100;
                            progressFill.style.width = `${progress}%`;
                            progressText.textContent = `${completed}/${usernames.length}`;
                        }
                        
                        // Update results in real-time
                        resultsOutput.value = resultLines.join('\n');
                    } catch (error) {
                        statusMessage.textContent = `Error in batch processing: ${error.message}`;
                    }
                }
                
                // All done
                progressBar.style.display = 'none';
                
                if (hasCachedResponses) {
                    statusMessage.textContent = 'Notice: Some responses were cached from playerdb.co';
                    statusMessage.classList.add('cached');
                } else {
                    statusMessage.textContent = 'All UUIDs fetched successfully!';
                }
            });
        });
