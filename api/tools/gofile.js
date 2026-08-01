const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const crypto = require('crypto');
const { parseSingleFile } = require("../_lib/parseMultipart");

let accountToken = null;
let websiteToken = null;

function generateWebsiteToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function getAccountToken() {
    try {
        const response = await axios.get('https://api.gofile.io/accounts', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
                'Accept': 'application/json'
            }
        });
        
        if (response.data.status === 'ok' && response.data.data && response.data.data.token) {
            accountToken = response.data.data.token;
            return {
                success: true,
                token: accountToken
            };
        }
        
        accountToken = crypto.randomBytes(32).toString('base64').replace(/[+/=]/g, '');
        return {
            success: true,
            token: accountToken
        };
        
    } catch (error) {
        accountToken = crypto.randomBytes(32).toString('base64').replace(/[+/=]/g, '');
        return {
            success: true,
            token: accountToken
        };
    }
}

function getHeaders() {
    const token = accountToken || crypto.randomBytes(32).toString('base64').replace(/[+/=]/g, '');
    const wt = websiteToken || generateWebsiteToken();
    
    return {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Host': 'api.gofile.io',
        'Origin': 'https://gofile.io',
        'Referer': 'https://gofile.io/',
        'Sec-Ch-Ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
        'Authorization': `Bearer ${token}`,
        'x-bl': 'id-ID',
        'x-website-token': wt,
        'Priority': 'u=1, i'
    };
}

function getUploadHeaders() {
    return {
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Host': 'upload.gofile.io',
        'Origin': 'https://gofile.io',
        'Referer': 'https://gofile.io/',
        'Sec-Ch-Ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
        'Sec-Ch-Ua-Mobile': '?1',
        'Sec-Ch-Ua-Platform': '"Android"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-site',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
        'Priority': 'u=1, i'
    };
}

async function getBestServer() {
    const response = await axios.get('https://api.gofile.io/servers', {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
            'Accept': 'application/json'
        },
        timeout: 15000
    });

    const data = response.data;
    if (data && data.status === 'ok' && data.data) {
        // Modern response shape: { data: { servers: [{name: "store1", zone: "eu"}, ...] } }
        const servers = data.data.servers || data.data.serversAllZone;
        if (Array.isArray(servers) && servers.length > 0) {
            return servers[0].name;
        }
        // Legacy shape: { data: { server: "store1" } }
        if (data.data.server) {
            return data.data.server;
        }
    }

    throw new Error('Tidak bisa mendapatkan server upload gofile.io');
}

async function uploadToGoFile(fileBuffer, filename) {
    try {
        const server = await getBestServer();

        const form = new FormData();
        form.append('file', fileBuffer, { filename });

        const response = await axios.post(`https://${server}.gofile.io/contents/uploadfile`, form, {
            headers: {
                ...form.getHeaders(),
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
                'Accept': 'application/json'
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
            timeout: 120000
        });

        const data = response.data;

        if (data && data.status === 'ok' && data.data) {
            const file = data.data;
            return {
                success: true,
                url: file.downloadPage || file.link,
                directUrl: file.downloadPage ? file.downloadPage : `https://gofile.io/d/${file.parentFolderCode || file.code}`,
                name: file.name,
                size: file.size,
                md5: file.md5,
                folderCode: file.parentFolderCode || file.code,
                folderId: file.parentFolder,
                guestToken: file.guestToken
            };
        }

        return {
            success: false,
            error: (data && data.status) ? `gofile status: ${data.status}` : 'Upload gagal',
            data: response.data
        };

    } catch (error) {
        const raw = error.response?.data;
        return {
            success: false,
            error: (typeof raw === 'string' ? raw.slice(0, 300) : null) || error.message,
            status: error.response?.status,
            data: raw
        };
    }
}

async function uploadMultipleToGoFile(files) {
    if (!accountToken) {
        await getAccountToken();
    }
    if (!websiteToken) {
        websiteToken = generateWebsiteToken();
    }
    
    const form = new FormData();
    
    for (const file of files) {
        form.append('files[]', file.buffer, { filename: file.filename });
    }
    
    try {
        const response = await axios.post('https://upload.gofile.io/uploadfile', form, {
            headers: {
                ...form.getHeaders(),
                ...getUploadHeaders()
            },
            timeout: 180000
        });
        
        if (response.data && response.data.status === 'ok') {
            const filesData = response.data.data.files || [response.data.data];
            const uploadedFiles = filesData.map(file => ({
                url: file.downloadPage || file.link,
                name: file.name,
                size: file.size,
                md5: file.md5
            }));
            
            return {
                success: true,
                files: uploadedFiles,
                folderCode: response.data.data.parentFolderCode
            };
        }
        
        return {
            success: false,
            error: 'Upload gagal',
            data: response.data
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        };
    }
}

async function createGoFileFolder(folderName, parentFolderId = null) {
    if (!accountToken) {
        await getAccountToken();
    }
    if (!websiteToken) {
        websiteToken = generateWebsiteToken();
    }
    
    const payload = {
        folderName: folderName
    };
    
    if (parentFolderId) {
        payload.parentFolderId = parentFolderId;
    }
    
    try {
        const response = await axios.post('https://api.gofile.io/contents/createfolder', 
            payload,
            {
                headers: getHeaders()
            }
        );
        
        if (response.data.status === 'ok') {
            return {
                success: true,
                folderId: response.data.data.id,
                name: response.data.data.name,
                parentFolderId: response.data.data.parentFolderId
            };
        }
        
        return {
            success: false,
            error: 'Gagal membuat folder',
            data: response.data
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        };
    }
}

async function getContents(folderId, page = 1, pageSize = 1000) {
    if (!accountToken) {
        await getAccountToken();
    }
    if (!websiteToken) {
        websiteToken = generateWebsiteToken();
    }
    
    try {
        const response = await axios.get(`https://api.gofile.io/contents/${folderId}`, {
            params: {
                contentFilter: '',
                page: page,
                pageSize: pageSize,
                sortField: 'name',
                sortDirection: 1
            },
            headers: getHeaders()
        });
        
        if (response.data.status === 'ok') {
            return {
                success: true,
                contents: response.data.data.contents || [],
                folderId: folderId
            };
        }
        
        return {
            success: false,
            error: 'Gagal mengambil konten',
            data: response.data
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message,
            status: error.response?.status,
            data: error.response?.data
        };
    }
}

async function uploadDummyToGoFile() {
    const dummyContent = Buffer.from('Ini adalah file dummy untuk testing upload ke GoFile', 'utf-8');
    const filename = `dummy_${crypto.randomBytes(4).toString('hex')}.txt`;
    return uploadToGoFile(dummyContent, filename);
}

async function uploadFromUrlToGoFile(fileUrl, filename = null) {
    try {
        const response = await axios.get(fileUrl, {
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36'
            }
        });
        
        const buffer = Buffer.from(response.data);
        const name = filename || fileUrl.split('/').pop() || 'file';
        
        return uploadToGoFile(buffer, name);
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

async function uploadFromPathToGoFile(filePath, filename = null) {
    try {
        const buffer = fs.readFileSync(filePath);
        const name = filename || filePath.split('/').pop() || 'file';
        return uploadToGoFile(buffer, name);
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// ---------- Vercel serverless handler wrapper ----------
async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ status: false, message: "Method not allowed" });
  }

  try {
    const file = await parseSingleFile(req, res, "file");

    if (!file) {
      return res.status(400).json({
        status: false,
        message: "File wajib diisi. Pastikan field bernama 'file' terlampir di form-data."
      });
    }

    const result = await uploadToGoFile(file.buffer, file.originalname);

    if (!result.success) {
      return res.status(result.status || 502).json({
        status: false,
        message: result.error || "gofile.io menolak file ini.",
        detail: result.data || null
      });
    }

    return res.json({
      status: true,
      creator: "multiput",
      result: {
        url: result.url,
        directUrl: result.directUrl,
        name: result.name,
        size: result.size,
        md5: result.md5,
        folderCode: result.folderCode
      }
    });

  } catch (e) {
    return res.status(e.response?.status || 500).json({
      status: false,
      message: e.response?.data?.message || e.message,
      detail: e.response?.data || null
    });
  }
}

handler.config = {
  api: {
    bodyParser: false
  }
};

module.exports = handler;
