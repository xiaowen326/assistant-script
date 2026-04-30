
// == 全局配置 ==
const BASE_URL = "https://ares.yxqiche.com";
let TOKEN = "";
let IS_TOKEN_VALID = false;

// == 工具函数 ==
function getTokenFromCookies() {
    const cookies = document.cookie.split(';');
    for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'token') {
            return value;
        }
    }
    return null;
}

function validateToken() {
    if (!TOKEN) {
        TOKEN = getTokenFromCookies() || GM_getValue('yixin_token', '') || TOKEN;
    }
    IS_TOKEN_VALID = !!TOKEN;
    return IS_TOKEN_VALID;
}

function createNotification(message, isSuccess = true, duration = 3000) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(-10px);
        padding: 15px 25px;
        background: ${isSuccess ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        z-index: 10000;
        font-family: Arial, sans-serif;
        font-size: 14px;
        font-weight: 500;
        opacity: 0;
        transition: opacity 0.3s, top 0.3s, transform 0.3s;
        max-width: 80vw;
        text-align: center;
    `;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.top = '30px';
        notification.style.transform = 'translateX(-50%) translateY(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.top = '20px';
        notification.style.transform = 'translateX(-50%) translateY(-10px)';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// == 错误处理函数 ==
function handleError(error, context) {
    console.error(`${context} 错误:`, error);
    const errorMessage = error.message || '未知错误';
    createNotification(`${context}失败: ${errorMessage}`, false, 4000);
}

function showPrompt(title, message) {
    return prompt(`${title}\n\n${message}`);
}


// == 公共函数 ==
function createProgressBar(title, totalTasks) {
    const loadingElement = document.createElement('div');
    loadingElement.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 1px solid #ccc;
        z-index: 9999;
        min-width: 300px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;

    const header = document.createElement('div');
    header.style = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
        margin-bottom: 10px;
    `;

    const titleElement = document.createElement('div');
    titleElement.textContent = title;
    titleElement.style.fontWeight = 'bold';

    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '−';
    minimizeBtn.style = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    `;
    minimizeBtn.addEventListener('mouseover', () => minimizeBtn.style.background = '#f0f0f0');
    minimizeBtn.addEventListener('mouseout', () => minimizeBtn.style.background = 'none');
    minimizeBtn.addEventListener('click', () => {
        loadingElement.style.display = 'none';
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            document.getElementById('task-title').textContent = `任务: ${title}`;
            document.getElementById('task-progress-text').textContent = `已完成: 0/${totalTasks}`;
            document.getElementById('task-progress-bar').style.width = `0%`;
            taskContainer.style.display = 'block';
        }
    });

    header.appendChild(titleElement);
    header.appendChild(minimizeBtn);
    loadingElement.appendChild(header);

    const counterElement = document.createElement('div');
    counterElement.id = 'query-counter';
    counterElement.textContent = `已完成: 0/${totalTasks}`;
    counterElement.style.marginBottom = '10px';
    counterElement.style.textAlign = 'center';
    counterElement.style.fontSize = '14px';
    loadingElement.appendChild(counterElement);

    const progressContainer = document.createElement('div');
    progressContainer.style = `
        width: 100%;
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
        overflow: hidden;
    `;

    const progressBar = document.createElement('div');
    progressBar.id = 'query-progress';
    progressBar.style = `
        width: 0%;
        height: 100%;
        background: linear-gradient(90deg, #4CAF50, #8BC34A);
        transition: width 0.3s ease;
    `;

    progressContainer.appendChild(progressBar);
    loadingElement.appendChild(progressContainer);

    return { loadingElement, counterElement, progressBar };
}

function updateProgress(counterElement, progressBar, completed, totalTasks) {
    counterElement.textContent = `已完成: ${completed}/${totalTasks}`;
    progressBar.style.width = `${(completed / totalTasks) * 100}%`;
    
    const taskContainer = document.getElementById('background-task');
    if (taskContainer && taskContainer.style.display !== 'none') {
        document.getElementById('task-progress-text').textContent = `已完成: ${completed}/${totalTasks}`;
        document.getElementById('task-progress-bar').style.width = `${(completed / totalTasks) * 100}%`;
    }
}

// == 结果显示函数 ==
function displayResults(results, title) {
    const oldResult = document.getElementById('result-container');
    if (oldResult) oldResult.remove();
    
    const container = document.createElement('div');
    container.id = 'result-container';
    container.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border: 2px solid #4CAF50;
        border-radius: 10px;
        padding: 20px;
        padding-right: 30px; /* 为滚动条预留空间 */
        max-width: 90vw;
        max-height: 80vh;
        overflow: auto;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 9999;
        font-family: Arial, sans-serif;
        box-sizing: content-box;
    `;
    
    // === 顶部标题栏（包含复制按钮、标题、关闭按钮） ===
    const headerContainer = document.createElement('div');
    headerContainer.style = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
        padding: 15px;
        border: 2px solid #4CAF50;
        border-radius: 8px;
        background: linear-gradient(135deg, #f8fff8 0%, #ffffff 100%);
        box-shadow: 0 2px 8px rgba(76, 175, 80, 0.15);
        position: sticky;
        top: 0;
        z-index: 100;
    `;
    
    // 复制按钮
    const copyButton = document.createElement('button');
    copyButton.textContent = '复制结果';
    copyButton.style = `
        padding: 8px 20px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    copyButton.onclick = () => {
        let text = '';
        if (results.length > 0) {
            const headers = Object.keys(results[0]);
            text = headers.join('\t') + '\r\n';
            results.forEach(result => {
                const row = headers.map(header => result[header] || '');
                text += row.join('\t') + '\r\n';
            });
        }
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style = `
            position: fixed;
            top: -100px;
            left: -100px;
            opacity: 0;
        `;
        document.body.appendChild(textarea);
        textarea.select();
        try {
            const success = document.execCommand('copy');
            if (success) {
                createNotification('结果已复制到剪贴板');
            } else {
                createNotification('复制失败，请手动复制', false);
            }
        } catch (err) {
            createNotification('复制失败: ' + err.message, false);
        } finally {
            document.body.removeChild(textarea);
        }
    };
    headerContainer.appendChild(copyButton);
    
    // 标题
    const titleElement = document.createElement('h2');
    titleElement.textContent = title;
    titleElement.style = 'margin: 0; color: #333; text-align: center; flex: 1;';
    headerContainer.appendChild(titleElement);
    
    // 关闭按钮
    const closeButton = document.createElement('button');
    closeButton.textContent = '关闭';
    closeButton.style = `
        padding: 8px 20px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    closeButton.onclick = () => container.remove();
    headerContainer.appendChild(closeButton);
    
    container.appendChild(headerContainer);
    
    if (results.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = '未查询到结果';
        emptyMessage.style = 'text-align: center;';
        container.appendChild(emptyMessage);
    } else {
        const table = document.createElement('table');
        table.style = 'width: 100%; border-collapse: collapse; min-width: 600px;';
        
        // 创建表头
        const headerRow = document.createElement('tr');
        const headers = Object.keys(results[0]);
        
        for (const header of headers) {
            const th = document.createElement('th');
            th.textContent = header;
            th.style = 'padding: 12px; background: #f2f2f2; text-align: center;';
            headerRow.appendChild(th);
        }
        table.appendChild(headerRow);
        
        // 创建数据行
        for (const result of results) {
            const row = document.createElement('tr');
            
            for (const key in result) {
                const td = document.createElement('td');
                td.textContent = result[key];
                td.style = 'padding: 10px; text-align: center;';

                // 特殊处理locationUrl显示为可点击链接
                if (key === 'locationUrl') {
                    td.innerHTML = result[key] !== "无" ? 
                        `<a href="${result[key]}" target="_blank">查看地图</a>` : "无";
                } 
                // 特殊处理historyComplaint字段
                else if (key === 'historyComplaint') {
                    if (result[key] === true || result[key] === 'true') {
                        td.textContent = '有投诉';
                        td.style.color = 'red';
                        td.style.fontWeight = '500';
                    } else if (result[key] === false || result[key] === 'false') {
                        td.textContent = '无';
                    } else {
                        td.textContent = result[key];
                    }
                }
                // 其他字段正常显示
                else {
                    td.textContent = result[key];
                }
                
                // 修改还款状态的颜色显示
                if (key === 'status') {
                    // 其他功能的status字段
                    td.style.color = result[key] === '成功' ? 'green' : 'red';
                } else if (key === 'status1') {
                    // 还款状态的第一轮查询结果
                    if (result[key] === '已还款') {
                        td.style.color = 'green';
                    } else if (result[key] === '查询失败') {
                        td.style.color = 'red';
                    }
                } else if (key === 'status2') {
                    // 还款状态的第二轮查询结果
                    if (result[key].includes('成功')) {
                        td.style.color = 'green';
                    } else if (result[key].includes('失败')) {
                        td.style.color = 'red';
                    }
                }
                
                row.appendChild(td);
            }
            
            table.appendChild(row);
        }
        
        container.appendChild(table);
    }
    
    // 返回顶部按钮
    const backToTopButton = document.createElement('button');
    backToTopButton.textContent = '返回顶部';
    backToTopButton.style = `
        display: block;
        margin: 20px auto 0;
        padding: 8px 20px;
        background: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    `;
    backToTopButton.onclick = () => {
        container.scrollTop = 0;
    };
    container.appendChild(backToTopButton);

    document.body.appendChild(container);
}

// ===== 新增的查询短信数据功能 =====
async function batchQuerySMSData() {
    if (!validateToken()) {
        createNotification('请先设置有效的Token', false);
        return;
    }

    const input = showPrompt('查询短信数据', '请输入要查询的记录条数（例如：10）:');
    if (!input) return;
    
    const pageSize = parseInt(input);
    if (isNaN(pageSize) || pageSize <= 0) {
        createNotification('请输入有效的数字!', false);
        return;
    }
    
    // 创建带进度条的加载提示
    const { loadingElement, counterElement, progressBar } = createProgressBar(`正在查询短信数据 (${pageSize}条)`, pageSize);
    document.body.appendChild(loadingElement);
    
    let totalTasks = 0;
    const resultsArray = [];
    let completed = 0;
    
    try {
        // 获取申请号列表
        const list = await queryList(pageSize);
        totalTasks = list.length;
        
        if (totalTasks === 0) {
            createNotification('未查询到任何申请号，请检查登录状态是否正常或刷新网页重试', false);
            loadingElement.remove();
            return;
        }
        
        counterElement.textContent = `已完成: 0/${totalTasks}`;
        progressBar.style.width = `0%`;
        
        // 并发处理所有申请号，使用索引保持顺序
        const processingPromises = list.map(async (item, index) => {
            try {
                const { applyNo, name, repayAmount, contributePartyName, overdueDays } = item;
                
                // 并行获取基础信息和联系人信息
                const [info, contacts] = await Promise.all([
                    getInfo(applyNo),
                    getContact(applyNo)
                ]);
                
                // 处理地址为null的情况
                const base = info?.base || {};
                const home = info?.home || {};
                
                const plaintextPhone = base.plaintextPhone || '无';
                const certificateNumber = base.certificateNumber || '无';
                
                // 地址为null时显示"无地址"
                const registerAddress = home.registerAddress || '无地址';
                const livingAddress = home.livingAddress || '无地址';
                
                const itemResults = [];
                if (contacts && contacts.length) {
                    for (const contact of contacts) {
                        itemResults.push({
                            申请号: applyNo,
                            姓名: name || '无',
                            电话: plaintextPhone,
                            还款金额: repayAmount || '无',
                            证件号: certificateNumber,
                            资方: contributePartyName || '无',
                            户籍地址: registerAddress, // 已处理null值
                            居住地址: livingAddress,   // 已处理null值
                            逾期天数: overdueDays || '无',
                            关系: contact.relation || '无',
                            联系人姓名: contact.name || '无',
                            联系人电话: contact.plaintextPhone || '无'
                        });
                    }
                } else {
                    itemResults.push({
                        申请号: applyNo,
                        姓名: name || '无',
                        电话: plaintextPhone,
                        还款金额: repayAmount || '无',
                        证件号: certificateNumber,
                        资方: contributePartyName || '无',
                        户籍地址: registerAddress, // 已处理null值
                        居住地址: livingAddress,   // 已处理null值
                        逾期天数: overdueDays || '无',
                        关系: '无',
                        联系人姓名: '无联系人',
                        联系人电话: '无'
                    });
                }
                
                resultsArray[index] = itemResults;
            } catch (error) {
                console.error(`处理申请号 ${item.applyNo} 失败:`, error);
                resultsArray[index] = [{
                    申请号: item.applyNo || '未知',
                    状态: `请求失败: ${error.message}`,
                    姓名: '无',
                    电话: '无',
                    还款金额: '无',
                    证件号: '无',
                    资方: '无',
                    户籍地址: '无地址', // 错误时保持"无地址"
                    居住地址: '无地址', // 错误时保持"无地址"
                    逾期天数: '无',
                    联系人姓名: '无',
                    联系人电话: '无'
                }];
            } finally {
                // 更新进度
                completed++;
                updateProgress(counterElement, progressBar, completed, totalTasks);
            }
        });
        
        // 等待所有处理完成
        await Promise.all(processingPromises);
        
        // 按顺序展开结果
        const results = resultsArray.flat();
        
        // 确保进度条显示为100%
        counterElement.textContent = `已完成: ${totalTasks}/${totalTasks}`;
        progressBar.style.width = `100%`;
        
        createNotification(`成功查询 ${results.length} 条短信数据`);
        displayResults(results, '短信数据查询结果');
        
    } catch (error) {
        console.error('全局处理错误:', error);
        createNotification('批量查询失败，请检查网络或重新登录账号', false);
    } finally {
        // 任务完成后隐藏进度显示
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            taskContainer.style.display = 'none';
        }
        
        // 移除进度窗口
        if (loadingElement.parentNode) {
            loadingElement.remove();
        }
    }
}

// ===== 短信数据查询相关函数 =====
async function queryList(pageSize = 10) {
    const url = `${BASE_URL}/ares-web/recall/pageQuery`;
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Origin": BASE_URL,
                "Cookie": `token=${TOKEN}`
            },
            body: JSON.stringify({
                "index": 1,
                "pageSize": pageSize,
                "searchInfoAll": "",
                "applyNo": ""
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.code !== 0) {
            throw new Error(`API错误: ${data.message || data.code}`);
        }
        
        return data.data?.items || [];
    } catch (error) {
        console.error('queryList错误:', error);
        throw new Error(`获取申请列表失败: ${error.message}`);
    }
}

async function getInfo(applyNo) {
    const url = `${BASE_URL}/ares-web/recall/baseinfo/query1`;
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Origin": BASE_URL,
                "Cookie": `token=${TOKEN}`
            },
            body: JSON.stringify({ applyNo })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
        }
        
        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error(`getInfo错误 (${applyNo}):`, error);
        throw new Error(`获取基础信息失败: ${error.message}`);
    }
}

async function getContact(applyNo) {
    const url = `${BASE_URL}/ares-web/recall/recallContactInfo/getContact`;
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
                "Origin": BASE_URL,
                "Cookie": `token=${TOKEN}`
            },
            body: JSON.stringify({ 
                "applyNo": applyNo,
                "pageSize": 1000 
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP错误! 状态: ${response.status}`);
        }
        
        const data = await response.json();
        return data.data?.items || [];
    } catch (error) {
        console.error(`getContact错误 (${applyNo}):`, error);
        throw new Error(`获取联系人信息失败: ${error.message}`);
    }
}

// == 查询销售功能 ==
async function batchQueryApplyNos() {
    if (!validateToken()) {
        createNotification('请先设置有效的Token', false);
        return;
    }

    const input = showPrompt('批量查询销售信息', '请输入申请号（多个用逗号或空格分隔）:');
    if (!input) return;
    
    const applyNos = input.split(/[,，\s]+/).filter(no => no.trim());
    if (applyNos.length === 0) {
        createNotification('未输入有效的申请号!', false);
        return;
    }
    
    // === 创建带进度条的加载提示 ===
    const loadingElement = document.createElement('div');
    loadingElement.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 1px solid #ccc;
        z-index: 9999;
        min-width: 300px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;

    // 创建标题栏（含最小化按钮）
    const header = document.createElement('div');
    header.style = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
        margin-bottom: 10px;
    `;

    const title = document.createElement('div');
    title.textContent = `正在查询申请号 (${applyNos.length}个)`;
    title.style.fontWeight = 'bold';

    // 创建最小化按钮
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '−';
    minimizeBtn.style = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    `;
    minimizeBtn.addEventListener('mouseover', () => minimizeBtn.style.background = '#f0f0f0');
    minimizeBtn.addEventListener('mouseout', () => minimizeBtn.style.background = 'none');
    minimizeBtn.addEventListener('click', () => {
        loadingElement.style.display = 'none';
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            document.getElementById('task-title').textContent = `任务: 查询申请号`;
            document.getElementById('task-progress-text').textContent = `已完成: ${completed}/${applyNos.length}`;
            document.getElementById('task-progress-bar').style.width = `${(completed / applyNos.length) * 100}%`;
            taskContainer.style.display = 'block';
        }
    });

    header.appendChild(title);
    header.appendChild(minimizeBtn);
    loadingElement.appendChild(header);

    // 创建计数器显示
    const counterElement = document.createElement('div');
    counterElement.id = 'query-counter';
    counterElement.textContent = `已完成: 0/${applyNos.length}`;
    counterElement.style.marginBottom = '10px';
    counterElement.style.textAlign = 'center';
    counterElement.style.fontSize = '14px';
    loadingElement.appendChild(counterElement);

    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.style = `
        width: 100%;
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
    `;

    // 创建进度条
    const progressBar = document.createElement('div');
    progressBar.id = 'query-progress';
    progressBar.style = `
        width: 0%;
        height: 100%;
        background: #4CAF50;
        border-radius: 5px;
        transition: width 0.3s ease;
    `;

    progressContainer.appendChild(progressBar);
    loadingElement.appendChild(progressContainer);
    document.body.appendChild(loadingElement);
    
    const results = new Array(applyNos.length);
    let completed = 0; // 跟踪完成数量
    const url = `${BASE_URL}/ares-web/recall/orderInfo/getSalesAndShopsInfoByApplyNo`;
    
    try {
        // 并发处理所有申请号，使用索引保持顺序
        const processingPromises = applyNos.map(async (applyNo, index) => {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Origin": BASE_URL,
                        "Cookie": `token=${TOKEN}`
                    },
                    body: JSON.stringify({ applyNo })
                });

                const data = await response.json();
                
                results[index] = {
                    applyNo,
                    status: data.code === 0 ? '成功' : `失败: ${data.message || data.code}`,
                    //channelManagerName: data.data?.channelManagerName || "无",
                    //channelManagerPhone: data.data?.channelManagerPhone || "无",
                    businessType: data.data?.businessType || "无",
                    advisorName: data.data?.advisorName || "无",
                    advisorPhone: data.data?.advisorPhone || "无",
                    directorName: data.data?.directorName || "无",
                    directorPhone: data.data?.directorPhone || "无"
                };
            } catch (error) {
                results[index] = {
                    applyNo,
                    status: '请求失败',
                    //channelManagerName: "无",
                    //channelManagerPhone: "无",
                    businessType: "无",
                    advisorName: "无",
                    advisorPhone: "无",
                    directorName: "无",
                    directorPhone: "无",
                    message: error.message
                };
            } finally {
                // 更新进度
                completed++;
                updateProgress(counterElement, progressBar, completed, applyNos.length);
            }
        });
        
        // 等待所有处理完成
        await Promise.all(processingPromises);
        
        // 确保进度条显示为100%
        counterElement.textContent = `已完成: ${applyNos.length}/${applyNos.length}`;
        progressBar.style.width = `100%`;
        
        createNotification(`成功查询 ${results.length} 个申请号`);
    } finally {
        // 任务完成后隐藏进度显示
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            taskContainer.style.display = 'none';
        }
        
        // 移除进度窗口
        if (loadingElement.parentNode) {
            loadingElement.remove();
        }
        
        displayResults(results, '申请号查询结（陈伟彬，陈小龙，莫婷婷，行凯凯，邓琴，白伦全，崔峰，佟妹，不是真实销售，请手动剔除）');
    }
}

// == 系统短信功能 ==
const SMS_TEMPLATES = {
    "委外低账龄-违约2": "018f04fe48248a8085bc8ef0c5d430e3",
    "委外低账龄-违约3": "018f04fea8ea8a8085bc8ef0c5d43122",
    "委外低账龄-违约4": "018f04ff22b48a8085bc8ef0c5d4315c",
    "委外低账龄-违约5": "018f04ff830b8a8085bc8ef0c5d431a5",
    "委外低账龄-违约6": "018f04fff43e8a8085bc8ef0c5d431c6",
    "委外低账龄-违约7": "018f2371e3138a8085bc8f14e37f2709",
    "委外低账龄-违约8": "018f237204968a8085bc8f14e37f2716",
    "委外低账龄-违约9": "018f237221128a8085bc8f14e37f2724",
    "委外低账龄-违约10": "018f23723ca98a8085bc8f14e37f272f",
    "委外低账龄-违约11": "018f2372598d8a8085bc8f14e37f2749",
    "委外低账龄-违约12": "018f237275d58a8085bc8f14e37f274e",
    "委外低账龄-违约13": "019d3dfc8d7e8a80b6b79d1a3b2d0ab0",
    "委外低账龄-违约14": "019d3dfce01b8a80b6b79d1a3b2d0b24",
    "委外低账龄-违约15": "019d3dfd319c8a80b6b79d1a3b2d0b85",
    "委外低账龄-诉讼1": "018f05175d698a8085bc8ef0c5d43d5d",
    "委外低账龄-诉讼2": "018f0517b0ba8a8085bc8ef0c5d43d8d",
    "委外低账龄-诉讼3": "018f051808888a8085bc8ef0c5d43dc0",
    "委外低账龄-诉讼4": "018f0519203e8a8085bc8ef0c5d43e70",
    "委外低账龄-诉讼5": "018f05198e608a8085bc8ef0c5d43eb2",
    "委外低账龄-诉讼6": "018f2372ba718a8085bc8f14e37f2771",
    "委外低账龄-诉讼7": "018f2372d9518a8085bc8f14e37f278a",
    "委外低账龄-征信3": "018f23729c7d8a8085bc8f14e37f2758",
    "委外低账龄-转告1": "019d3df933d48a80b6b79d1a3b2d0571",
    "委外低账龄-转告2": "019d3df99c168a80b6b79d1a3b2d066c",
    "委外低账龄-转告3": "019d3dfa1aaa8a80b6b79d1a3b2d071a",
    "委外低账龄-转告4": "019d3dfa7eda8a80b6b79d1a3b2d077f",
    "委外低账龄-转告5": "019d3dfad79c8a80b6b79d1a3b2d07dc",
    "委外低账龄-转告6": "019d3dfb3d568a80b6b79d1a3b2d0841",
    "委外低账龄-转告7": "019d3dfbb1e08a80b6b79d1a3b2d08b8",
    "委外低账龄-转告8": "019d3dfc083b8a80b6b79d1a3b2d0957",
    "通知联系紧急联系人（委外）2": "019b0234ff8f8a80b6b79ae8e0c65c6b"
};


// 扩展：自定义带分页按钮的弹窗（适配你的嵌入式页面）
function showTemplatePrompt(title, message) {
    return new Promise((resolve) => {
        // 1. 创建弹窗容器（适配ares.yxqiche.com嵌入式页面样式）
        const promptContainer = document.createElement('div');
        promptContainer.style.position = 'fixed';
        promptContainer.style.top = '50%';
        promptContainer.style.left = '50%';
        promptContainer.style.transform = 'translate(-50%, -50%)';
        promptContainer.style.width = '500px';
        promptContainer.style.backgroundColor = '#fff';
        promptContainer.style.border = '1px solid #ccc';
        promptContainer.style.borderRadius = '8px';
        promptContainer.style.padding = '20px';
        promptContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        promptContainer.style.zIndex = 9999;

        // 2. 弹窗标题
        const titleEl = document.createElement('h4');
        titleEl.textContent = title;
        titleEl.style.margin = '0 0 15px 0';
        titleEl.style.fontSize = '16px';
        promptContainer.appendChild(titleEl);

        // 3. 模板列表区域（带滚动）
        const contentEl = document.createElement('div');
        contentEl.textContent = message;
        contentEl.style.whiteSpace = 'pre-wrap';
        contentEl.style.maxHeight = '300px';
        contentEl.style.overflowY = 'auto';
        contentEl.style.margin = '0 0 15px 0';
        contentEl.style.fontSize = '14px';
        promptContainer.appendChild(contentEl);

        // 4. 输入框（选择模板编号）
        const inputEl = document.createElement('input');
        inputEl.type = 'text';
        inputEl.placeholder = '请输入模板编号';
        inputEl.style.width = '100%';
        inputEl.style.padding = '8px';
        inputEl.style.boxSizing = 'border-box';
        inputEl.style.margin = '0 0 15px 0';
        inputEl.style.border = '1px solid #ccc';
        inputEl.style.borderRadius = '4px';
        promptContainer.appendChild(inputEl);

        // 5. 按钮区域（上一页 + 下一页 + 确定 + 取消）
        const btnContainer = document.createElement('div');
        btnContainer.style.display = 'flex';
        btnContainer.style.gap = '10px';
        btnContainer.style.justifyContent = 'center';
        promptContainer.appendChild(btnContainer);

        // 5.1 上一页按钮
        const prevBtn = document.createElement('button');
        prevBtn.textContent = '上一页';
        prevBtn.style.padding = '8px 20px';
        prevBtn.style.border = 'none';
        prevBtn.style.borderRadius = '4px';
        prevBtn.style.backgroundColor = '#409EFF';
        prevBtn.style.color = '#fff';
        prevBtn.style.cursor = 'pointer';
        btnContainer.appendChild(prevBtn);

        // 5.2 下一页按钮
        const nextBtn = document.createElement('button');
        nextBtn.textContent = '下一页';
        nextBtn.style.padding = '8px 20px';
        nextBtn.style.border = 'none';
        nextBtn.style.borderRadius = '4px';
        nextBtn.style.backgroundColor = '#409EFF';
        nextBtn.style.color = '#fff';
        nextBtn.style.cursor = 'pointer';
        btnContainer.appendChild(nextBtn);

        // 5.3 确定按钮
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = '确定';
        confirmBtn.style.padding = '8px 20px';
        confirmBtn.style.border = 'none';
        confirmBtn.style.borderRadius = '4px';
        confirmBtn.style.backgroundColor = '#67C23A';
        confirmBtn.style.color = '#fff';
        confirmBtn.style.cursor = 'pointer';
        btnContainer.appendChild(confirmBtn);

        // 5.4 取消按钮
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.padding = '8px 20px';
        cancelBtn.style.border = 'none';
        cancelBtn.style.borderRadius = '4px';
        cancelBtn.style.backgroundColor = '#F56C6C';
        cancelBtn.style.color = '#fff';
        cancelBtn.style.cursor = 'pointer';
        btnContainer.appendChild(cancelBtn);

        // 6. 挂载到页面
        document.body.appendChild(promptContainer);
        inputEl.focus();

        // 7. 按钮事件绑定
        let result = null;
        // 上一页按钮：返回特定标识
        prevBtn.addEventListener('click', () => {
            resolve('上一页');
            document.body.removeChild(promptContainer);
        });
        // 下一页按钮：返回特定标识
        nextBtn.addEventListener('click', () => {
            resolve('下一页');
            document.body.removeChild(promptContainer);
        });
        // 确定按钮：返回输入值
        confirmBtn.addEventListener('click', () => {
            result = inputEl.value.trim();
            resolve(result);
            document.body.removeChild(promptContainer);
        });
        // 取消按钮：返回null
        cancelBtn.addEventListener('click', () => {
            resolve(null);
            document.body.removeChild(promptContainer);
        });
        // 回车触发确定
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') confirmBtn.click();
        });

        // 8. 销毁弹窗（防止残留）
        window.addEventListener('beforeunload', () => {
            if (document.body.contains(promptContainer)) {
                document.body.removeChild(promptContainer);
            }
        });
    });
}

async function sendBatchSMS() {
    if (!validateToken()) {
        createNotification('请先设置有效的Token', false);
        return;
    }

    const applyNosInput = showPrompt('批量发送系统短信', '请输入申请号列表（多个用逗号或换行分隔）:');
    if (!applyNosInput) return;
    
    const applyNos = applyNosInput.split(/[\n,，\s]+/).filter(no => no.trim());
    if (applyNos.length === 0) {
        createNotification('未输入有效的申请号!', false);
        return;
    }
    
    const phonesInput = showPrompt('发送系统短信', `请按顺序输入 ${applyNos.length} 个手机号（用相同分隔符）:`);
    if (!phonesInput) return;
    
    const phones = phonesInput.split(/[\n,，\s]+/).filter(p => p.trim());
    
    if (applyNos.length !== phones.length) {
        createNotification(`申请号数量 (${applyNos.length}) 与手机号数量 (${phones.length}) 不匹配!`, false);
        return;
    }
    
    // -------------------------- 核心修改：带按钮的分页逻辑 --------------------------
    const templateNames = Object.keys(SMS_TEMPLATES);
    const PAGE_SIZE = 16; // 每页显示16个模板（匹配你的截图显示效果）
    let currentPage = 1;
    const totalPages = Math.ceil(templateNames.length / PAGE_SIZE);
    let templateChoice = null;

    // 分页选择模板的循环
    while (true) {
        // 计算当前页的模板范围
        const startIdx = (currentPage - 1) * PAGE_SIZE;
        const endIdx = Math.min(startIdx + PAGE_SIZE, templateNames.length);
        const currentPageTemplates = templateNames.slice(startIdx, endIdx);

        // 生成当前页的模板列表（保留原格式：编号. 模板名）
        const templateList = currentPageTemplates.map((t, i) => {
            const realIndex = startIdx + i + 1; // 模板的真实全局编号
            return `${realIndex}. ${t}`;
        }).join('\n');

        // 拼接分页提示语（简化，因为新增了按钮）
        const promptMessage = `请选择短信模板(转告1-转告8用来发送三方)：
							【测试中，如遇问题及时反馈】
当前页：${currentPage}/${totalPages} | 每页显示${PAGE_SIZE}个
----------------------------------------
${templateList}
----------------------------------------
总模板数：${templateNames.length} | 可选编号：1-${templateNames.length}`;

        // 调用【带分页按钮】的自定义弹窗（替代原showPrompt）
        const userInput = await showTemplatePrompt('选择短信模板', promptMessage);
        
        // 用户点击取消
        if (!userInput) {
            templateChoice = null;
            break;
        }

        const input = userInput.trim();
        // 处理按钮触发的分页指令
        if (input === '上一页' || input === '下一页') {
            if (input === '上一页' && currentPage > 1) {
                currentPage--;
            } else if (input === '下一页' && currentPage < totalPages) {
                currentPage++;
            } else {
                // 页码越界提示
                createNotification(`已到${input === '上一页' ? '第一页' : '最后一页'}!`, false);
            }
            continue; // 继续循环，展示切换后的页码
        }

        // 处理输入框的模板编号选择
        const templateIndex = parseInt(input) - 1;
        if (isNaN(templateIndex) || templateIndex < 0 || templateIndex >= templateNames.length) {
            createNotification(`无效的模板选择! 请输入1-${templateNames.length}之间的数字`, false);
            continue;
        }

        // 选择有效，退出循环
        templateChoice = input;
        break;
    }

    // 用户取消选择模板
    if (!templateChoice) return;
    
    const templateIndex = parseInt(templateChoice) - 1;
    const templateName = templateNames[templateIndex];
    const templateId = SMS_TEMPLATES[templateName];
    
    // 创建映射关系
    const mapping = {};
    for (let i = 0; i < applyNos.length; i++) {
        const applyNo = applyNos[i];
        const phone = phones[i];
        
        if (!mapping[applyNo]) {
            mapping[applyNo] = [];
        }
        mapping[applyNo].push(phone);
    }
    
    const totalTasks = Object.keys(mapping).length;
    let successCount = 0;
    let errorCount = 0;
    const resultsArray = new Array(totalTasks);
    const mappingKeys = Object.keys(mapping);
    let results = [];
    
    // === 创建带进度条的加载提示 ===
    const loadingElement = document.createElement('div');
    loadingElement.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 1px solid #ccc;
        z-index: 9999;
        min-width: 300px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;

    // 创建标题栏（含最小化按钮）
    const header = document.createElement('div');
    header.style = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
        margin-bottom: 10px;
    `;

    const title = document.createElement('div');
    title.textContent = `正在发送短信 (${totalTasks}个申请号)`;
    title.style.fontWeight = 'bold';

    // 创建最小化按钮
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '−';
    minimizeBtn.style = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    `;
    minimizeBtn.addEventListener('mouseover', () => minimizeBtn.style.background = '#f0f0f0');
    minimizeBtn.addEventListener('mouseout', () => minimizeBtn.style.background = 'none');
    minimizeBtn.addEventListener('click', () => {
        loadingElement.style.display = 'none';
        // 在系统助手悬浮窗上显示进度
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            document.getElementById('task-title').textContent = `任务: 发送短信`;
            document.getElementById('task-progress-text').textContent = `已完成: ${completed}/${totalTasks}`;
            document.getElementById('task-progress-bar').style.width = `${(completed / totalTasks) * 100}%`;
            taskContainer.style.display = 'block';
        }
    });

    header.appendChild(title);
    header.appendChild(minimizeBtn);
    loadingElement.appendChild(header);

    // 创建计数器显示
    const counterElement = document.createElement('div');
    counterElement.id = 'sms-counter';
    counterElement.textContent = `已完成: 0/${totalTasks}`;
    counterElement.style.marginBottom = '10px';
    counterElement.style.textAlign = 'center';
    counterElement.style.fontSize = '14px';
    loadingElement.appendChild(counterElement);

    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.style = `
        width: 100%;
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
    `;

    // 创建进度条
    const progressBar = document.createElement('div');
    progressBar.id = 'sms-progress';
    progressBar.style = `
        width: 0%;
        height: 100%;
        background: #4CAF50;
        border-radius: 5px;
        transition: width 0.3s ease;
    `;

    progressContainer.appendChild(progressBar);
    loadingElement.appendChild(progressContainer);
    document.body.appendChild(loadingElement);
    
    let completed = 0; // 跟踪完成数量
    
    try {
        // 并发处理所有申请号，使用索引保持顺序
        const processingPromises = mappingKeys.map(async (applyNo, index) => {
            const phoneList = mapping[applyNo];
            try {
                const response = await fetch(`${BASE_URL}/ares-web/message/send/record/outsource/low/send`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Cookie': `token=${TOKEN}`
                    },
                    body: JSON.stringify({
                        applyNo,
                        messageTemplateId: templateId,
                        phones: phoneList,
                        params: {}
                    })
                });
                
                if (!response.ok) throw new Error(`HTTP错误! 状态: ${response.status}`);
                
                const data = await response.json();
                if (data.code === 0) {
                    successCount++;
                    resultsArray[index] = {
                        applyNo,
                        phones: phoneList.join(', '),
                        status: '成功',
                        message: '短信发送成功'
                    };
                } else {
                    errorCount++;
                    resultsArray[index] = {
                        applyNo,
                        phones: phoneList.join(', '),
                        status: '失败',
                        message: data.message || `错误代码: ${data.code}`
                    };
                }
            } catch (error) {
                errorCount++;
                resultsArray[index] = {
                    applyNo,
                    phones: phoneList.join(', '),
                    status: '失败',
                    message: error.message
                };
            } finally {
                // 更新进度
                completed++;
                counterElement.textContent = `已完成: ${completed}/${totalTasks}`;
                progressBar.style.width = `${(completed / totalTasks) * 100}%`;
                
                // 更新悬浮窗进度（如果已最小化）
                const taskContainer = document.getElementById('background-task');
                if (taskContainer && taskContainer.style.display !== 'none') {
                    document.getElementById('task-progress-text').textContent = `已完成: ${completed}/${totalTasks}`;
                    document.getElementById('task-progress-bar').style.width = `${(completed / totalTasks) * 100}%`;
                }
            }
        });
        
        // 等待所有处理完成
        await Promise.all(processingPromises);
        
        // 确保进度条显示为100%
        counterElement.textContent = `已完成: ${totalTasks}/${totalTasks}`;
        progressBar.style.width = `100%`;
        
        // 过滤掉undefined的结果（如果有的话）
        results = resultsArray.filter(result => result !== undefined);
        
        createNotification(`短信发送完成! 成功: ${successCount}, 失败: ${errorCount}`);
    } finally {
        // 任务完成后隐藏进度显示
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            taskContainer.style.display = 'none';
        }
        
        // 移除进度窗口
        if (loadingElement.parentNode) {
            loadingElement.remove();
        }
        
        displayResults(results, '短信发送结果');
    }
}
// == 查询还款功能 ==
async function batchQueryRepayment() {
    if (!validateToken()) {
        createNotification('请先设置有效的Token', false);
        return;
    }

    const input = showPrompt('批量查询还款状态', '请输入申请号（多个用逗号或空格分隔）:');
    if (!input) return;
    
    const applyNos = input.split(/[,，\s]+/).filter(no => no.trim());
    if (applyNos.length === 0) {
        createNotification('未输入有效的申请号!', false);
        return;
    }
    
    // === 创建带进度条的加载提示 ===
    const loadingElement = document.createElement('div');
    loadingElement.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 1px solid #ccc;
        z-index: 9999;
        min-width: 300px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;

    // 创建标题栏（含最小化按钮）
    const header = document.createElement('div');
    header.style = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
        margin-bottom: 10px;
    `;

    const title = document.createElement('div');
    title.textContent = `正在查询还款状态 (${applyNos.length}个申请号)`;
    title.style.fontWeight = 'bold';

    // 创建最小化按钮
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '−';
    minimizeBtn.style = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    `;
    minimizeBtn.addEventListener('mouseover', () => minimizeBtn.style.background = '#f0f0f0');
    minimizeBtn.addEventListener('mouseout', () => minimizeBtn.style.background = 'none');
    minimizeBtn.addEventListener('click', () => {
        loadingElement.style.display = 'none';
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            document.getElementById('task-title').textContent = `任务: 查询还款状态`;
            document.getElementById('task-progress-text').textContent = `已完成: ${completed}/${applyNos.length}`;
            document.getElementById('task-progress-bar').style.width = `${(completed / applyNos.length) * 100}%`;
            taskContainer.style.display = 'block';
        }
    });

    header.appendChild(title);
    header.appendChild(minimizeBtn);
    loadingElement.appendChild(header);

    // 创建计数器显示
    const counterElement = document.createElement('div');
    counterElement.id = 'repayment-counter';
    counterElement.textContent = `已完成: 0/${applyNos.length}`;
    counterElement.style.marginBottom = '10px';
    counterElement.style.textAlign = 'center';
    counterElement.style.fontSize = '14px';
    loadingElement.appendChild(counterElement);

    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.style = `
        width: 100%;
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
    `;

    // 创建进度条
    const progressBar = document.createElement('div');
    progressBar.id = 'repayment-progress';
    progressBar.style = `
        width: 0%;
        height: 100%;
        background: #4CAF50;
        border-radius: 5px;
        transition: width 0.3s ease;
    `;

    progressContainer.appendChild(progressBar);
    loadingElement.appendChild(progressContainer);
    document.body.appendChild(loadingElement);
    
    const results = new Array(applyNos.length);
    let completed = 0; // 跟踪完成数量
    
    try {
        // 并发处理所有申请号，使用索引保持顺序
        const processingPromises = applyNos.map(async (applyNo, index) => {
            try {
                const result = await checkRepaymentStatus(applyNo);
                results[index] = result;
            } catch (error) {
                results[index] = {
                    applyNo,
                    status1: '查询失败',
                    status2: '查询失败',
                    message: error.message
                };
            } finally {
                // 更新进度
                completed++;
                updateProgress(counterElement, progressBar, completed, applyNos.length);
            }
        });
        
        // 等待所有处理完成
        await Promise.all(processingPromises);
        
        // 确保进度条显示为100%
        counterElement.textContent = `已完成: ${applyNos.length}/${applyNos.length}`;
        progressBar.style.width = `100%`;
        
        createNotification(`成功查询 ${results.length} 个申请号`);
    } finally {
        // 任务完成后隐藏进度显示
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            taskContainer.style.display = 'none';
        }
        
        // 移除进度窗口
        if (loadingElement.parentNode) {
            loadingElement.remove();
        }
        
        displayResults(results, '还款状态查询结果');
    }
}

// 工具函数 - 提取日期
function extractDatesFromText(text) {
    const datePatterns = [
        '\\d{4}-\\d{1,2}-\\d{1,2}',  // YYYY-MM-DD
        '\\d{4}/\\d{1,2}/\\d{1,2}',  // YYYY/MM/DD
        '\\d{4}年\\d{1,2}月\\d{1,2}日'  // YYYY年MM月DD日
    ];
    
    const dates = [];
    datePatterns.forEach(pattern => {
        const regex = new RegExp(pattern, 'g');
        const matches = text.match(regex);
        if (matches) dates.push(...matches);
    });
    
    return dates;
}

// 工具函数 - 检查是否最近日期
function isRecentDate(dateStr) {
    try {
        const dateObj = new Date(dateStr);
        if (isNaN(dateObj.getTime())) return false;
        
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        return (
            dateObj.toDateString() === today.toDateString() ||
            dateObj.toDateString() === yesterday.toDateString()
        );
    } catch {
        return false;
    }
}

// 第一轮查询
async function firstRoundQuery(applyNo) {
    try {
        const response = await fetch(`${BASE_URL}/ares-web/recall/baseinfo/query2`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json;charset=UTF-8',
                'Referer': `${BASE_URL}/ares-web/ares-vue/index.html?_rp-1346634870=-1346634870`,
                'Origin': BASE_URL,
                'Cookie': `token=${TOKEN}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({ applyNo })
        });
        
        if (!response.ok) throw new Error(`HTTP错误! 状态: ${response.status}`);
        
        const data = await response.text();
        return data.includes("已逾期") ? "未还款" : "已还款";
    } catch (error) {
        console.error(`第一轮查询失败 (${applyNo}):`, error);
        return "查询失败";
    }
}

// 第二轮查询 - 修复版
async function secondRoundQuery(applyNo) {
    try {
        const response = await fetch(`${BASE_URL}/ares-web/recall/baseinfo/charge/settleQuery`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'Content-Type': 'application/json;charset=UTF-8',
                'Referer': `${BASE_URL}/ares-web/ares-vue/index.html?_rp493222382=493222382`,
                'Origin': BASE_URL,
                'Cookie': `token=${TOKEN}`,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
            },
            body: JSON.stringify({ applyNo, index: 1, pageSize: 2 })
        });
        
        if (!response.ok) throw new Error(`HTTP错误! 状态: ${response.status}`);
        
        const data = await response.text();
        
        // 修复点：更精确地判断扣款状态
        if (data.includes("成功")) {
            const allDates = extractDatesFromText(data);
            for (const dateStr of allDates) {
                if (isRecentDate(dateStr)) {
                    return "扣款成功";
                }
            }
            return "扣款失败（扣款日期非今日或昨日）";
        }
        
        return "扣款失败";
    } catch (error) {
        console.error(`第二轮查询失败 (${applyNo}):`, error);
        return "查询失败";
    }
}

// 检查还款状态
async function checkRepaymentStatus(applyNo) {
    const status1 = await firstRoundQuery(applyNo);
    
    let status2 = "不适用";
    if (status1 === "未还款") {
        status2 = await secondRoundQuery(applyNo);
    }
    
    return { applyNo, status1, status2 };
}

// == 自动催记功能 ==
const DEFAULT_VALUES = {
    phoneState: "",
    relation: "99",
    phoneStatus: "100203",
    gpsStatus: "",
    communicateResult: "018bb723bbe78a8085bc8bb3a1b25c69",
    communicateDate: "",
    remarks: "",
    communicationType: "",
    promisePayType: "",
    promisePayer: "",
    promisePayMoney: "",
    promisePayChannel: "",
    planFollowTime: "",
    relationStr: "本人",
    overdueReason: ""
};

function parseBatchInput(input) {
    const lines = input.split('\n').filter(line => line.trim());
    const entries = [];
    
    for (const line of lines) {
        const parts = line.split(/[,\t\s]+/).filter(part => part.trim());
        if (parts.length >= 3) {
            const [applyNo, name, phone] = parts;
            entries.push({ applyNo, name, phone });
        }
    }
    return entries;
}

async function addBatchRemarks() {
    if (!validateToken()) {
        createNotification('请先设置有效的Token', false);
        return;
    }

    const batchInput = showPrompt('批量添加催记', `请输入批量数据（每行一组）：\n格式：申请号,姓名,手机号\n例如：\n3299717605,刘明,13800138000\n\n请复制粘贴您的数据：`);
    if (!batchInput) return;
    
    const entries = parseBatchInput(batchInput);
    if (entries.length === 0) {
        createNotification("未找到有效数据!", false);
        return;
    }
    
    // === 创建带进度条的加载提示 ===
    const loadingElement = document.createElement('div');
    loadingElement.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 1px solid #ccc;
        z-index: 9999;
        min-width: 300px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;

    // 创建标题栏（含最小化按钮）
    const header = document.createElement('div');
    header.style = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
        margin-bottom: 10px;
    `;

    const title = document.createElement('div');
    title.textContent = `正在添加催记 (${entries.length}个)`;
    title.style.fontWeight = 'bold';

    // 创建最小化按钮
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '−';
    minimizeBtn.style = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    `;
    minimizeBtn.addEventListener('mouseover', () => minimizeBtn.style.background = '#f0f0f0');
    minimizeBtn.addEventListener('mouseout', () => minimizeBtn.style.background = 'none');
    minimizeBtn.addEventListener('click', () => {
        loadingElement.style.display = 'none';
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            document.getElementById('task-title').textContent = `任务: 添加催记`;
            document.getElementById('task-progress-text').textContent = `已完成: ${completed}/${entries.length}`;
            document.getElementById('task-progress-bar').style.width = `${(completed / entries.length) * 100}%`;
            taskContainer.style.display = 'block';
        }
    });

    header.appendChild(title);
    header.appendChild(minimizeBtn);
    loadingElement.appendChild(header);

    // 创建计数器显示
    const counterElement = document.createElement('div');
    counterElement.id = 'remark-counter';
    counterElement.textContent = `已完成: 0/${entries.length}`;
    counterElement.style.marginBottom = '10px';
    counterElement.style.textAlign = 'center';
    counterElement.style.fontSize = '14px';
    loadingElement.appendChild(counterElement);

    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.style = `
        width: 100%;
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
    `;

    // 创建进度条
    const progressBar = document.createElement('div');
    progressBar.id = 'remark-progress';
    progressBar.style = `
        width: 0%;
        height: 100%;
        background: #4CAF50;
        border-radius: 5px;
        transition: width 0.3s ease;
    `;

    progressContainer.appendChild(progressBar);
    loadingElement.appendChild(progressContainer);
    document.body.appendChild(loadingElement);
    
    const results = new Array(entries.length);
    let completed = 0; // 跟踪完成数量
    let successCount = 0;
    let errorCount = 0;
    
    try {
        // 并发处理所有条目，使用索引保持顺序
        const processingPromises = entries.map(async (entry, index) => {
            const { applyNo, name, phone } = entry;
            try {
                const response = await fetch(`${BASE_URL}/ares-web/outsourceTask/low/remark/create`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json, text/plain, */*',
                        'Content-Type': 'application/json;charset=UTF-8',
                        'Cookie': `token=${TOKEN}`
                    },
                    body: JSON.stringify({
                        ...DEFAULT_VALUES,
                        applyNo,
                        name,
                        phone
                    })
                });
                
                if (!response.ok) throw new Error(`HTTP错误! 状态: ${response.status}`);
                
                const data = await response.json();
                if (data.code === 0) {
                    successCount++;
                    results[index] = {
                        applyNo,
                        name,
                        phone,
                        status: '成功',
                        message: '添加成功'
                    };
                } else {
                    errorCount++;
                    results[index] = {
                        applyNo,
                        name,
                        phone,
                        status: '失败',
                        message: data.message || `错误代码: ${data.code}`
                    };
                }
            } catch (error) {
                errorCount++;
                results[index] = {
                    applyNo,
                    name,
                    phone,
                    status: '失败',
                    message: error.message
                };
            } finally {
                // 更新进度
                completed++;
                counterElement.textContent = `已完成: ${completed}/${entries.length}`;
                progressBar.style.width = `${(completed / entries.length) * 100}%`;
                
                // 更新悬浮窗进度（如果已最小化）
                const taskContainer = document.getElementById('background-task');
                if (taskContainer && taskContainer.style.display !== 'none') {
                    document.getElementById('task-progress-text').textContent = `已完成: ${completed}/${entries.length}`;
                    document.getElementById('task-progress-bar').style.width = `${(completed / entries.length) * 100}%`;
                }
            }
        });
        
        // 等待所有处理完成
        await Promise.all(processingPromises);
        
        // 确保进度条显示为100%
        counterElement.textContent = `已完成: ${entries.length}/${entries.length}`;
        progressBar.style.width = `100%`;
        
        createNotification(`催记添加完成! 成功: ${successCount}, 失败: ${errorCount}`);
    } finally {
        // 任务完成后隐藏进度显示
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            taskContainer.style.display = 'none';
        }
        
        // 移除进度窗口
        if (loadingElement.parentNode) {
            loadingElement.remove();
        }
        
        displayResults(results, '催记添加结果');
    }
}


// == 查询客户画像功能 ==
async function AiBaseInfo() {
    if (!validateToken()) {
        createNotification('请先设置有效的Token', false);
        return;
    }

    const input = showPrompt('批量查询客户ai画像', '请输入申请号（多个用逗号或空格分隔）:');
    if (!input) return;
    
    const applyNos = input.split(/[,，\s]+/).filter(no => no.trim());
    if (applyNos.length === 0) {
        createNotification('未输入有效的申请号!', false);
        return;
    }
    
    // === 创建带进度条的加载提示 ===
    const loadingElement = document.createElement('div');
    loadingElement.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 1px solid #ccc;
        z-index: 9999;
        min-width: 300px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;

    // 创建标题栏（含最小化按钮）
    const header = document.createElement('div');
    header.style = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
        margin-bottom: 10px;
    `;

    const title = document.createElement('div');
    title.textContent = `正在查询申请号 (${applyNos.length}个)`;
    title.style.fontWeight = 'bold';

    // 创建最小化按钮
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '−';
    minimizeBtn.style = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    `;
    minimizeBtn.addEventListener('mouseover', () => minimizeBtn.style.background = '#f0f0f0');
    minimizeBtn.addEventListener('mouseout', () => minimizeBtn.style.background = 'none');
    minimizeBtn.addEventListener('click', () => {
        loadingElement.style.display = 'none';
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            document.getElementById('task-title').textContent = `任务: 查询申请号`;
            document.getElementById('task-progress-text').textContent = `已完成: ${completed}/${applyNos.length}`;
            document.getElementById('task-progress-bar').style.width = `${(completed / applyNos.length) * 100}%`;
            taskContainer.style.display = 'block';
        }
    });

    header.appendChild(title);
    header.appendChild(minimizeBtn);
    loadingElement.appendChild(header);

    // 创建计数器显示
    const counterElement = document.createElement('div');
    counterElement.id = 'query-counter';
    counterElement.textContent = `已完成: 0/${applyNos.length}`;
    counterElement.style.marginBottom = '10px';
    counterElement.style.textAlign = 'center';
    counterElement.style.fontSize = '14px';
    loadingElement.appendChild(counterElement);

    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.style = `
        width: 100%;
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
    `;

    // 创建进度条
    const progressBar = document.createElement('div');
    progressBar.id = 'query-progress';
    progressBar.style = `
        width: 0%;
        height: 100%;
        background: #4CAF50;
        border-radius: 5px;
        transition: width 0.3s ease;
    `;

    progressContainer.appendChild(progressBar);
    loadingElement.appendChild(progressContainer);
    document.body.appendChild(loadingElement);
    
    const results = new Array(applyNos.length);
    let completed = 0; // 跟踪完成数量
    const url = `${BASE_URL}/ares-web/recall/baseinfo/queryAiBaseInfo`;
    
    try {
        // 并发处理所有申请号，使用索引保持顺序
        const processingPromises = applyNos.map(async (applyNo, index) => {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Origin": BASE_URL,
                        "Cookie": `token=${TOKEN}`
                    },
                    body: JSON.stringify({ applyNo })
                });

                const data = await response.json();
                
                results[index] = {
                    applyNo,
                    status: data.code === 0 ? '成功' : `失败: ${data.message || data.code}`,
collectionLanguage: data.data?.collectionLanguage || "无",
collectionSms: data.data?.collectionSms || "无",
recentOverdueImage: data.data?.recentOverdueImage || "无"
                };
            } catch (error) {
                results[index] = {
                    applyNo,
                    status: `请求失败: ${error.message}`,
                    collectionLanguage: "无",
                    collectionSms: "无",
                    recentOverdueImage: "无",
                };
            } finally {
                // 更新进度
                completed++;
                updateProgress(counterElement, progressBar, completed, applyNos.length);
            }
        });
        
        // 等待所有处理完成
        await Promise.all(processingPromises);
        
        // 确保进度条显示为100%
        counterElement.textContent = `已完成: ${applyNos.length}/${applyNos.length}`;
        progressBar.style.width = `100%`;
        
        createNotification(`成功查询 ${results.length} 个申请号`);
    } finally {
        // 任务完成后隐藏进度显示
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            taskContainer.style.display = 'none';
        }
        
        // 移除进度窗口
        if (loadingElement.parentNode) {
            loadingElement.remove();
        }
        
        displayResults(results, '申请号查询结果');
    }
}

// == 查询车牌号功能 ==
async function batchQuery2ApplyNos() {
    if (!validateToken()) {
        createNotification('请先设置有效的Token', false);
        return;
    }

    const input = showPrompt('批量查询车辆信息', '请输入申请号（多个用逗号或空格分隔）:');
    if (!input) return;
    
    const applyNos = input.split(/[,，\s]+/).filter(no => no.trim());
    if (applyNos.length === 0) {
        createNotification('未输入有效的申请号!', false);
        return;
    }
    
    // === 创建带进度条的加载提示 ===
    const loadingElement = document.createElement('div');
    loadingElement.style = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border: 1px solid #ccc;
        z-index: 9999;
        min-width: 300px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    `;

    // 创建标题栏（含最小化按钮）
    const header = document.createElement('div');
    header.style = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding-bottom: 10px;
        border-bottom: 1px solid #eee;
        margin-bottom: 10px;
    `;

    const title = document.createElement('div');
    title.textContent = `正在查询申请号 (${applyNos.length}个)`;
    title.style.fontWeight = 'bold';

    // 创建最小化按钮
    const minimizeBtn = document.createElement('button');
    minimizeBtn.textContent = '−';
    minimizeBtn.style = `
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        transition: background 0.2s;
    `;
    minimizeBtn.addEventListener('mouseover', () => minimizeBtn.style.background = '#f0f0f0');
    minimizeBtn.addEventListener('mouseout', () => minimizeBtn.style.background = 'none');
    minimizeBtn.addEventListener('click', () => {
        loadingElement.style.display = 'none';
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            document.getElementById('task-title').textContent = `任务: 查询申请号`;
            document.getElementById('task-progress-text').textContent = `已完成: ${completed}/${applyNos.length}`;
            document.getElementById('task-progress-bar').style.width = `${(completed / applyNos.length) * 100}%`;
            taskContainer.style.display = 'block';
        }
    });

    header.appendChild(title);
    header.appendChild(minimizeBtn);
    loadingElement.appendChild(header);

    // 创建计数器显示
    const counterElement = document.createElement('div');
    counterElement.id = 'query-counter';
    counterElement.textContent = `已完成: 0/${applyNos.length}`;
    counterElement.style.marginBottom = '10px';
    counterElement.style.textAlign = 'center';
    counterElement.style.fontSize = '14px';
    loadingElement.appendChild(counterElement);

    // 创建进度条容器
    const progressContainer = document.createElement('div');
    progressContainer.style = `
        width: 100%;
        height: 10px;
        background: #e0e0e0;
        border-radius: 5px;
    `;

    // 创建进度条
    const progressBar = document.createElement('div');
    progressBar.id = 'query-progress';
    progressBar.style = `
        width: 0%;
        height: 100%;
        background: #4CAF50;
        border-radius: 5px;
        transition: width 0.3s ease;
    `;

    progressContainer.appendChild(progressBar);
    loadingElement.appendChild(progressContainer);
    document.body.appendChild(loadingElement);
    
    const results = new Array(applyNos.length);
    let completed = 0; // 跟踪完成数量
    const url = `${BASE_URL}/ares-web/recall/baseinfo/query2`;
    
    try {
        // 并发处理所有申请号，使用索引保持顺序
        const processingPromises = applyNos.map(async (applyNo, index) => {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Origin": BASE_URL,
                        "Cookie": `token=${TOKEN}`
                    },
                    body: JSON.stringify({ applyNo })
                });

                const data = await response.json();
                
                results[index] = {
                    applyNo,
                    status: data.code === 0 ? '成功' : `失败: ${data.message || data.code}`,
                    color: data.data?.overdue?.color || "无",
                    brand: data.data?.overdue?.brand || "无",
                    model: data.data?.overdue?.model || "无",
                    licensePlateNum: data.data?.overdue?.licensePlateNum || "无",
                    对公期数: data.data?.repay?.examinePeriod || "无对公记录"
                };
            } catch (error) {
                results[index] = {
                    applyNo,
                    status: `请求失败: ${error.message}`,
                    color: "无",
                    brand: "无",
                    model: "无",
                    licensePlateNum: "无",
                    examinePeriod: "无"
                };
            } finally {
                // 更新进度
                completed++;
                updateProgress(counterElement, progressBar, completed, applyNos.length);
            }
        });
        
        // 等待所有处理完成
        await Promise.all(processingPromises);
        
        // 确保进度条显示为100%
        counterElement.textContent = `已完成: ${applyNos.length}/${applyNos.length}`;
        progressBar.style.width = `100%`;
        
        createNotification(`成功查询 ${results.length} 个申请号`);
    } finally {
        // 任务完成后隐藏进度显示
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            taskContainer.style.display = 'none';
        }
        
        // 移除进度窗口
        if (loadingElement.parentNode) {
            loadingElement.remove();
        }
        
        displayResults(results, '申请号查询结果');
    }
}

// == 查询历史客诉功能 ==
async function batchhistoryComplaint() {
    if (!validateToken()) {
        createNotification('请先设置有效的Token', false);
        return;
    }

    const input = showPrompt('批量查询历史客诉', '请输入申请号（多个用逗号或空格分隔）:');
    if (!input) return;
    
    const applyNos = input.split(/[,，\s]+/).filter(no => no.trim());
    if (applyNos.length === 0) {
        createNotification('未输入有效的申请号!', false);
        return;
    }
    
    // === 创建带进度条的加载提示 ===
    const { loadingElement, counterElement, progressBar } = createProgressBar(`正在查询申请号 (${applyNos.length}个)`, applyNos.length);
    document.body.appendChild(loadingElement);
    
    const results = new Array(applyNos.length);
    let completed = 0; // 跟踪完成数量
    const url = `${BASE_URL}/ares-web/recall/baseinfo/query1`;
    
    try {
        // 并发处理所有申请号，使用索引保持顺序
        const processingPromises = applyNos.map(async (applyNo, index) => {
            try {
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Accept": "application/json",
                        "Content-Type": "application/json",
                        "Origin": BASE_URL,
                        "Cookie": `token=${TOKEN}`
                    },
                    body: JSON.stringify({ applyNo })
                });

                const data = await response.json();
                
                results[index] = {
                    applyNo,
                    status: data.code === 0 ? '成功' : `失败: ${data.message || data.code}`,
                    historyComplaint: data.data?.base?.historyComplaint ?? "无"
                };
            } catch (error) {
                results[index] = {
                    applyNo,
                    status: `请求失败: ${error.message}`,
                    historyComplaint: "无"
                };
            } finally {
                // 更新进度
                completed++;
                updateProgress(counterElement, progressBar, completed, applyNos.length);
            }
        });
        
        // 等待所有处理完成
        await Promise.all(processingPromises);
        
        // 确保进度条显示为100%
        counterElement.textContent = `已完成: ${applyNos.length}/${applyNos.length}`;
        progressBar.style.width = `100%`;
        
        createNotification(`成功查询 ${results.length} 个申请号`);
    } finally {
        // 任务完成后隐藏进度显示
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            taskContainer.style.display = 'none';
        }
        
        // 移除进度窗口
        if (loadingElement.parentNode) {
            loadingElement.remove();
        }
        
        displayResults(results, '申请号查询结果');
    }
}

// == 合并查询功能：车辆位置+车辆信息 ==
async function batchQueryCarAndBaseInfo() {
    if (!validateToken()) {
        createNotification('请先设置有效的Token', false);
        return;
    }

    const input = showPrompt('批量查询车辆信息', '请输入申请号（多个用逗号或空格分隔）:');
    if (!input) return;
    
    const applyNos = input.split(/[,，\s]+/).filter(no => no.trim());
    if (applyNos.length === 0) {
        createNotification('未输入有效的申请号!', false);
        return;
    }
    
    // === 创建带进度条的加载提示 ===
    const { loadingElement, counterElement, progressBar } = createProgressBar(`正在查询车辆信息 (${applyNos.length}个)`, applyNos.length);
    document.body.appendChild(loadingElement);
    
    const results = new Array(applyNos.length);
    let completed = 0; // 跟踪完成数量
    const carLocalUrl = `${BASE_URL}/ares-web/recall/car`;
    const baseInfoUrl = `${BASE_URL}/ares-web/recall/baseinfo/query2`;
    
    try {
        // 并发处理所有申请号，使用索引保持顺序
        const processingPromises = applyNos.map(async (applyNo, index) => {
            try {
                // 同时发起两个请求
                const [carLocalResponse, baseInfoResponse] = await Promise.all([
                    fetch(carLocalUrl, {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                            "Origin": BASE_URL,
                            "Cookie": `token=${TOKEN}`
                        },
                        body: JSON.stringify({ applyNo })
                    }),
                    fetch(baseInfoUrl, {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/json",
                            "Origin": BASE_URL,
                            "Cookie": `token=${TOKEN}`
                        },
                        body: JSON.stringify({ applyNo })
                    })
                ]);

                const carLocalData = await carLocalResponse.json();
                const baseInfoData = await baseInfoResponse.json();
                
                // 合并两个接口的结果
                const mergedResult = {
                    applyNo,
                    //status_location: carLocalData.code === 0 ? '成功' : `失败: ${carLocalData.message || carLocalData.code}`,
                    //status_baseinfo: baseInfoData.code === 0 ? '成功' : `失败: ${baseInfoData.message || baseInfoData.code}`,
                    // 车辆位置信息
                    locationUrl: carLocalData.data?.devices?.[0]?.locationUrl || "无",
                    //online: carLocalData.data?.devices?.[0]?.online || "无",
                    vin: carLocalData.data?.devices?.[0]?.vin || "无",
                    //num: carLocalData.data?.devices?.[0]?.num || "无",
                    // 车辆基础信息
                    color: baseInfoData.data?.overdue?.color || "无",
                    brand: baseInfoData.data?.overdue?.brand || "无",
                    model: baseInfoData.data?.overdue?.model || "无",
                    licensePlateNum: baseInfoData.data?.overdue?.licensePlateNum || "无",
                    对公期数: baseInfoData.data?.repay?.examinePeriod || "无对公记录"
                };
                
                results[index] = mergedResult;
            } catch (error) {
                results[index] = {
                    applyNo,
                    //status_location: `请求失败: ${error.message}`,
                    //status_baseinfo: `请求失败: ${error.message}`,
                    locationUrl: "无",
                    //online: "无",
                    vin: "无",
                    //num: "无",
                    color: "无",
                    brand: "无",
                    model: "无",
                    licensePlateNum: "无",
                    对公期数: "无"
                };
            } finally {
                // 更新进度
                completed++;
                updateProgress(counterElement, progressBar, completed, applyNos.length);
            }
        });
        
        // 等待所有处理完成
        await Promise.all(processingPromises);
        
        // 确保进度条显示为100%
        counterElement.textContent = `已完成: ${applyNos.length}/${applyNos.length}`;
        progressBar.style.width = `100%`;
        
        createNotification(`成功查询 ${results.length} 个申请号`);
    } finally {
        // 任务完成后隐藏进度显示
        const taskContainer = document.getElementById('background-task');
        if (taskContainer) {
            taskContainer.style.display = 'none';
        }
        
        // 移除进度窗口
        if (loadingElement.parentNode) {
            loadingElement.remove();
        }
        
        displayResults(results, '车辆信息查询结果');
    }
}


// == 主界面 ==

// == 励志名言数组（可扩展） ==
const INSPIRATION_QUOTES = [
  "成功不是终点，失败不是致命的，继续前进的勇气才是最重要的。",
  "每一次努力都不会白费，每一步都在靠近目标。",
  "相信自己，你比想象中更强大。",
  "困难像弹簧，你强它就弱，你弱它就强。",
  "不为失败找借口，只为成功找方法。",
  "人生没有彩排，每天都是现场直播。",
  "只要功夫深，铁杵磨成针。",
  "宝剑锋从磨砺出，梅花香自苦寒来。",
  "天生我材必有用，千金散尽还复来。",
  "路漫漫其修远兮，吾将上下而求索。",
"海上生明月，天涯共此时",
"春风又绿江南岸，明月何时照我还",
"人生若只如初见，何事秋风悲画扇",
"醉后不知天在水，满船清梦压星河",
"落花人独立，微雨燕双飞",
"小楼一夜听春雨，深巷明朝卖杏花",
"孤帆远影碧空尽，唯见长江天际流",
"欲买桂花同载酒，终不似，少年游",
"沾衣欲湿杏花雨，吹面不寒杨柳风",
"疏影横斜水清浅，暗香浮动月黄昏",
"溪云初起日沉阁，山雨欲来风满楼",
"二十四桥明月夜，玉人何处教吹箫",
"月落乌啼霜满天，江枫渔火对愁眠",
"两个黄鹂鸣翠柳，一行白鹭上青天",
"云想衣裳花想容，春风拂槛露华浓",
"此情可待成追忆，只是当时已惘然",
"我见青山多妩媚，料青山见我应如是",
"竹外桃花三两枝，春江水暖鸭先知",
"天街小雨润如酥，草色遥看近却无",
"接天莲叶无穷碧，映日荷花别样红",
"迟日江山丽，春风花草香",
"长风破浪会有时，直挂云帆济沧海",
"露从今夜白，月是故乡明",
"明月松间照，清泉石上流",
"落霞与孤鹜齐飞，秋水共长天一色",
"山重水复疑无路，柳暗花明又一村",
"大漠孤烟直，长河落日圆",
"疏影横斜水清浅，暗香浮动月黄昏"
];

// == 获取随机名言 ==
function getRandomQuote() {
  const randomIndex = Math.floor(Math.random() * INSPIRATION_QUOTES.length);
  return INSPIRATION_QUOTES[randomIndex];
}

// == 主界面（悬浮窗） ==
function createHelperUI() {
  if (document.getElementById('helper-container')) return;
  
  const container = document.createElement('div');
  container.id = 'helper-container';
  container.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 2px solid #4CAF50;
    border-radius: 10px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 9999;
    font-family: Arial, sans-serif;
    width: 300px;
    max-width: 90vw;
  `;
    // === 新增：后台任务进度显示区域 ===
    const taskProgressContainer = document.createElement('div');
    taskProgressContainer.id = 'background-task';
    taskProgressContainer.style.cssText = `
        display: none; /* 默认隐藏 */
        position: relative;
        border-top: 1px solid #eee;
        padding: 10px;
        background: #f9f9f9;
    `;
    
    // 任务标题
    const taskTitle = document.createElement('div');
    taskTitle.id = 'task-title';
    taskTitle.style.cssText = 'font-weight: bold; margin-bottom: 5px;';
    taskProgressContainer.appendChild(taskTitle);
    
    // 进度文本
    const taskProgressText = document.createElement('div');
    taskProgressText.id = 'task-progress-text';
    taskProgressText.style.cssText = 'font-size: 12px; margin-bottom: 5px;';
    taskProgressContainer.appendChild(taskProgressText);
    
    // 进度条容器
    const taskProgressBarContainer = document.createElement('div');
    taskProgressBarContainer.style.cssText = `
        width: 100%;
        height: 6px;
        background: #e0e0e0;
        border-radius: 3px;
        margin-bottom: 5px;
    `;
    const taskProgressBar = document.createElement('div');
    taskProgressBar.id = 'task-progress-bar';
    taskProgressBar.style.cssText = `
        width: 0%;
        height: 100%;
        background: #4CAF50;
        border-radius: 3px;
        transition: width 0.3s ease;
    `;
    taskProgressBarContainer.appendChild(taskProgressBar);
    taskProgressContainer.appendChild(taskProgressBarContainer);
    
    // 取消按钮（可选）
    const cancelButton = document.createElement('button');
    cancelButton.textContent = '取消';
    cancelButton.style.cssText = `
        position: absolute;
        top: 10px;
        right: 10px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 3px;
        padding: 3px 8px;
        font-size: 12px;
        cursor: pointer;
    `;
    taskProgressContainer.appendChild(cancelButton);
    
    container.appendChild(taskProgressContainer); // 将后台任务区域添加到悬浮窗
 

  // === 1. 标题栏（包含拖拽、标题、折叠按钮） ===
  const titleBar = document.createElement('div');
  titleBar.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 5px 10px;
    border-bottom: 1px solid #eee;
  `;
	
  // 拖拽手柄（左）
  const dragHandle = document.createElement('div');
  dragHandle.textContent = '≡';
  dragHandle.style.cssText = `
    cursor: move;
    font-size: 20px;
    color: #888;
  `;
  titleBar.appendChild(dragHandle);

  // 标题（中）
  const title = document.createElement('div');
  title.textContent = '易鑫云系统助手';
  title.style.cssText = `
    font-size: 18px;
    font-weight: bold;
    color: #2e7d32;
  `;
  titleBar.appendChild(title);

  // 缩放控制按钮组
  const zoomControls = document.createElement('div');
  zoomControls.style.cssText = `
    display: flex;
    align-items: center;
    gap: 5px;
  `;
  
  // 缩小按钮
  const zoomOutBtn = document.createElement('button');
  zoomOutBtn.textContent = '−';
  zoomOutBtn.style.cssText = `
    background: none;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 16px;
    color: #666;
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // 缩放级别显示
  const zoomLevel = document.createElement('span');
  zoomLevel.textContent = '100%';
  zoomLevel.style.cssText = `
    font-size: 12px;
    color: #666;
    min-width: 40px;
    text-align: center;
  `;
  
  // 放大按钮
  const zoomInBtn = document.createElement('button');
  zoomInBtn.textContent = '+';
  zoomInBtn.style.cssText = `
    background: none;
    border: 1px solid #ddd;
    border-radius: 3px;
    font-size: 16px;
    color: #666;
    cursor: pointer;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  zoomControls.appendChild(zoomOutBtn);
  zoomControls.appendChild(zoomLevel);
  zoomControls.appendChild(zoomInBtn);
  
  // 折叠按钮（右）
  const collapseBtn = document.createElement('button');
  collapseBtn.textContent = '−'; // 初始为折叠状态（显示内容）
  collapseBtn.style.cssText = `
    background: none;
    border: none;
    font-size: 20px;
    color: #888;
    cursor: pointer;
    padding: 0 5px;
    margin-left: 10px;
  `;
  
  zoomControls.appendChild(collapseBtn);
  titleBar.appendChild(zoomControls);

  container.appendChild(titleBar);

  // === 2. 随机励志名言（标题栏下方） ===
  const quoteElement = document.createElement('div');
  quoteElement.className = 'inspiration-quote';
  quoteElement.style.cssText = `
    padding: 10px 15px;
    color: #666;
    font-style: italic;
    font-size: 14px;
    border-bottom: 1px solid #eee;
    min-height: 40px; /* 固定高度，避免折叠时跳动 */
  `;
  container.appendChild(quoteElement);

  // === 3. 内容容器（状态提示+功能按钮，可折叠） ===
  const helperContent = document.createElement('div');
  helperContent.className = 'helper-content';
  helperContent.style.cssText = `
    padding: 15px;
  `;

  // === 3.1 Token状态提示（放在内容容器内） ===
  const tokenStatus = document.createElement('div');
  tokenStatus.id = 'token-status';
  tokenStatus.style.cssText = `
    display: flex;
    align-items: center;
    margin-bottom: 15px;
  `;

  const statusIndicator = document.createElement('div');
  statusIndicator.id = 'token-status-indicator';
  statusIndicator.style.cssText = `
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #f44336;
    margin-right: 10px;
    box-shadow: 0 0 8px rgba(244, 67, 54, 0.5);
  `;

  const statusText = document.createElement('span');
  statusText.id = 'token-status-text';
  statusText.textContent = '未设置Token';
  statusText.style.cssText = 'color: #f44336; font-weight: bold;';

  tokenStatus.appendChild(statusIndicator);
  tokenStatus.appendChild(statusText);
  helperContent.appendChild(tokenStatus); // 将状态提示放入内容容器


  // === 3.2 功能按钮（放在内容容器内） ===
  const buttons = [
    { text: '批量查询销售', action: batchQueryApplyNos, color: '#2E7D32' }, // 深绿色 - 代表成功和效率
    { text: '发送系统短信', action: sendBatchSMS, color: '#1976D2' }, // 深蓝色 - 代表沟通和信任
    { text: '查询还款状态', action: batchQueryRepayment, color: '#FF9800' }, // 橙色 - 代表提醒和警告
    { text: '批量添加催记', action: addBatchRemarks, color: '#7B1FA2' }, // 深紫色 - 代表专业和创新
    //{ text: '查询车辆信息', action: batchQuery2ApplyNos, color: '#607D8B' },
    { text: '查询客户画像', action: AiBaseInfo, color: '#0288D1' }, // 亮蓝色 - 代表智能和分析
    { text: '查询历史客诉', action: batchhistoryComplaint, color: '#C62828' }, // 深红色 - 代表警示和重要
    { text: '合并查询车辆信息', action: batchQueryCarAndBaseInfo, color: '#E64A19' }, // 橙红色 - 代表综合和整合
    { text: '查询短信数据', action: batchQuerySMSData, color: '#455A64' }, // 深灰色 - 代表数据和信息
    // { text: '设置Token', action: setToken, color: '#607D8B' }
  ];

  for (const button of buttons) {
    const btn = document.createElement('button');
    btn.textContent = button.text;
    btn.style.cssText = `
      display: block;
      width: 100%;
      padding: 12px;
      margin: 6px 0;
      background: ${button.color};
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      font-size: 14px;
      transition: all 0.3s ease;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;
        btn.addEventListener('mouseover', () => {
            btn.style.opacity = '0.9';
            btn.style.transform = 'translateY(-1px)';
            btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        });
        btn.addEventListener('mouseout', () => {
            btn.style.opacity = '1';
            btn.style.transform = 'translateY(0)';
            btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        });
        btn.addEventListener('mousedown', () => {
            btn.style.transform = 'translateY(1px)';
        });
        btn.addEventListener('mouseup', () => {
            btn.style.transform = 'translateY(-1px)';
        });
        btn.addEventListener('click', button.action);
    helperContent.appendChild(btn); // 将按钮放入内容容器
  }

  container.appendChild(helperContent); // 将内容容器加入悬浮窗

  // === 4. 折叠按钮交互逻辑 ===
  collapseBtn.addEventListener('click', () => {
    const isCollapsed = helperContent.style.display === 'none';
    // 切换内容容器显示状态
    helperContent.style.display = isCollapsed ? 'block' : 'none';
    // 切换折叠按钮图标（−/+)
    collapseBtn.textContent = isCollapsed ? '−' : '+';
    // 展开时更新名言
    if (!isCollapsed) {
      quoteElement.textContent = getRandomQuote();
    }
  });

  // === 5. 初始化励志名言 ===
  quoteElement.textContent = getRandomQuote();

  // === 6. 拖拽功能（保持原有逻辑，调整手柄位置） ===
  let isDragging = false;
  let offsetX, offsetY;

  dragHandle.addEventListener('mousedown', (e) => {
    isDragging = true;
    const rect = container.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    e.preventDefault(); // 防止文本选中
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newLeft = e.clientX - offsetX;
    const newTop = e.clientY - offsetY;
    // 限制悬浮窗不超出窗口边界（可选）
    const maxLeft = window.innerWidth - container.offsetWidth;
    const maxTop = window.innerHeight - container.offsetHeight;
    container.style.left = `${Math.min(Math.max(newLeft, 0), maxLeft)}px`;
    container.style.top = `${Math.min(Math.max(newTop, 0), maxTop)}px`;
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // === 7. 缩放功能 ===
  let currentZoom = 100; // 初始缩放级别
  const minZoom = 50;    // 最小缩放级别
  const maxZoom = 150;   // 最大缩放级别
  const zoomStep = 10;   // 缩放步长

  // 缩放函数
  function zoom(amount) {
    currentZoom = Math.max(minZoom, Math.min(maxZoom, currentZoom + amount));
    zoomLevel.textContent = `${currentZoom}%`;
    container.style.transform = `scale(${currentZoom / 100})`;
    container.style.transformOrigin = 'top right';
  }

  // 缩小按钮点击事件
  zoomOutBtn.addEventListener('click', () => {
    zoom(-zoomStep);
  });

  // 放大按钮点击事件
  zoomInBtn.addEventListener('click', () => {
    zoom(zoomStep);
  });

  document.body.appendChild(container);

       // 初始检查Token
    updateTokenStatus();
}
function updateTokenStatus() {
    const statusIndicator = document.getElementById('token-status-indicator');
    const statusText = document.getElementById('token-status-text');
    
    if (validateToken()) {
        statusIndicator.style.backgroundColor = '#4CAF50';
        statusIndicator.style.boxShadow = '0 0 8px rgba(76, 175, 80, 0.6)';
        statusText.textContent = 'Token已设置';
        statusText.style.color = '#2e7d32';
    } else {
        statusIndicator.style.backgroundColor = '#f44336';
        statusIndicator.style.boxShadow = '0 0 8px rgba(244, 67, 54, 0.5)';
        statusText.textContent = '未设置Token';
        statusText.style.color = '#f44336';
    }
}

function setToken() {
    const newToken = showPrompt('设置Token', '请输入新的Token值:');
    if (newToken) {
        TOKEN = newToken;
        GM_setValue('yixin_token', newToken);  // 持久化到油猴存储
        updateTokenStatus();
        createNotification('Token已更新并保存!');
    }
}

// == 密码验证 ==
// 正确密码的SHA-256哈希值（防止密码明文暴露在代码中）
// 默认密码: dyx2016 — 如需修改，请替换下方HASH值为新密码的SHA-256哈希
const PASSWORD_HASH = '1fe29d04860465436423c76f8873db63439f8448e106675f898c07c5b6377297';
let IS_AUTHENTICATED = false;

// SHA-256哈希函数
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// 创建密码输入弹窗
function createPasswordDialog(callback) {
    // 如果已验证过，直接跳过
    const savedHash = GM_getValue('auth_hash', '');
    if (savedHash === PASSWORD_HASH) {
        IS_AUTHENTICATED = true;
        callback();
        return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 99999;
        display: flex; justify-content: center; align-items: center;
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white; border-radius: 12px; padding: 30px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3); width: 340px; text-align: center;
        font-family: Arial, sans-serif;
    `;

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 18px; font-weight: bold; margin-bottom: 8px; color: #333;';
    title.textContent = '🔒 系统助手验证';

    const subtitle = document.createElement('div');
    subtitle.style.cssText = 'font-size: 13px; color: #888; margin-bottom: 20px;';
    subtitle.textContent = '请输入授权密码以启用助手';

    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = '请输入密码';
    input.style.cssText = `
        width: 100%; padding: 12px 16px; border: 2px solid #e0e0e0;
        border-radius: 8px; font-size: 15px; outline: none;
        transition: border-color 0.3s; box-sizing: border-box;
    `;
    input.addEventListener('focus', function() { this.style.borderColor = '#4CAF50'; });
    input.addEventListener('blur', function() { this.style.borderColor = '#e0e0e0'; });

    const errorTip = document.createElement('div');
    errorTip.style.cssText = 'color: #f44336; font-size: 12px; margin-top: 8px; height: 16px;';

    const btn = document.createElement('button');
    btn.textContent = '确认解锁';
    btn.style.cssText = `
        width: 100%; padding: 12px; margin-top: 16px;
        background: #4CAF50; color: white; border: none;
        border-radius: 8px; font-size: 15px; font-weight: bold;
        cursor: pointer; transition: background 0.3s;
    `;
    btn.addEventListener('mouseenter', function() { this.style.background = '#43A047'; });
    btn.addEventListener('mouseleave', function() { this.style.background = '#4CAF50'; });

    const rememberLabel = document.createElement('label');
    rememberLabel.style.cssText = 'display: flex; align-items: center; margin-top: 12px; font-size: 13px; color: #666; cursor: pointer;';
    const rememberCheck = document.createElement('input');
    rememberCheck.type = 'checkbox';
    rememberCheck.style.cssText = 'margin-right: 6px;';
    rememberCheck.checked = true;
    rememberLabel.appendChild(rememberCheck);
    rememberLabel.appendChild(document.createTextNode('记住密码（本次浏览器会话有效）'));

    async function verify() {
        const pwd = input.value.trim();
        if (!pwd) { errorTip.textContent = '请输入密码'; return; }
        const hash = await sha256(pwd);
        if (hash === PASSWORD_HASH) {
            IS_AUTHENTICATED = true;
            if (rememberCheck.checked) {
                GM_setValue('auth_hash', hash);
            }
            overlay.remove();
            callback();
        } else {
            errorTip.textContent = '密码错误，请重试';
            input.value = '';
            input.style.borderColor = '#f44336';
            setTimeout(() => { input.style.borderColor = '#e0e0e0'; }, 1500);
        }
    }

    btn.addEventListener('click', verify);
    input.addEventListener('keydown', function(e) { if (e.key === 'Enter') verify(); });

    dialog.appendChild(title);
    dialog.appendChild(subtitle);
    dialog.appendChild(input);
    dialog.appendChild(errorTip);
    dialog.appendChild(btn);
    dialog.appendChild(rememberLabel);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    setTimeout(() => input.focus(), 100);
}

// == 初始化助手 ==
// 全局单例：用GM存储做锁，整个浏览器只允许创建一次UI
(function initHelper() {
    if (window.location.hostname !== 'ares.yxqiche.com' && !window.location.hostname.includes('ares.yxqiche')) {
        return;
    }

    // 检查是否已有实例在运行
    if (GM_getValue('helper_instance_active', false)) {
        console.log('[易鑫云系统助手] 已有实例运行，跳过');
        return;
    }

    // 先验证密码，通过后再初始化
    createPasswordDialog(function() {
        // 加锁
        GM_setValue('helper_instance_active', true);

        // 页面卸载时释放锁
        window.addEventListener('beforeunload', function() {
            GM_setValue('helper_instance_active', false);
        });

        TOKEN = getTokenFromCookies() || GM_getValue('yixin_token', '') || TOKEN;
        createHelperUI();
        createNotification('易鑫云系统助手已加载!');
    });
})();
